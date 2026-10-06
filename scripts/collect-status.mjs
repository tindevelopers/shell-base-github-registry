#!/usr/bin/env node
// scripts/collect-status.mjs
//
// Collector for the TIN ops console (tin-ops-console, spec section 3). Records OBSERVED state only:
//   - package versions and divergence, from REGISTER.json (written by generate-register.mjs)
//   - cell health, from tin-boss-api/cells/*.json plus GET <url>/healthz and /readyz
// into the console's Neon database, as the collector_writer role. It never reads or writes
// the console's declared registry (projects, pins, owners): the console is the authority for that.
//
// Requires:
//   NEON_COLLECTOR_URL        connection string for the collector_writer role (not set: skips with a warning)
//   GITHUB_TOKEN / GH_TOKEN   read access to tindevelopers/tin-boss-api (for cells/*.json)
//
// Usage: node scripts/collect-status.mjs [--dry-run] [--register REGISTER.json]
//   --dry-run prints what would be written and touches neither the network database nor Neon.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CELLS_API = "https://api.github.com/repos/tindevelopers/tin-boss-api/contents/cells";
export const HEALTH_TIMEOUT_MS = 5000;
export const RETENTION_DAYS = 90;

// ---- pure: building snapshot rows --------------------------------------------------

export function packageSnapshots(register) {
  return register.rows.map((r) => ({
    package: r.package,
    repo: r.repo,
    branchVersion: r.branchVersion ?? null,
    latest: r.latest ?? null,
    next: r.next ?? null,
    divergence: r.divergence,
    dependents: r.dependents ?? [],
  }));
}

/** The cell id is the file name, e.g. cells/konnect-dev.json is "konnect-dev". */
export function parseCell(fileName, json) {
  const cell = fileName.replace(/\.json$/, "");
  for (const k of ["client", "region"]) if (typeof json[k] !== "string" || !json[k]) throw new Error(`${fileName}: missing "${k}"`);
  if (!Number.isInteger(json.ring)) throw new Error(`${fileName}: missing integer "ring"`);
  return { cell, client: json.client, ring: json.ring, region: json.region, url: typeof json.url === "string" && json.url ? json.url : null };
}

async function status(fetchFn, url) {
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS), redirect: "manual" });
    return res.status;
  } catch {
    return null; // timeout, DNS, TLS, refused: no HTTP status was obtained
  }
}

/** A cell with no url is recorded with null statuses (unhealthy), never skipped. */
export async function checkCell(cell, fetchFn, now = new Date()) {
  const base = cell.url?.replace(/\/+$/, "");
  const [healthzStatus, readyzStatus] = base
    ? await Promise.all([status(fetchFn, `${base}/healthz`), status(fetchFn, `${base}/readyz`)])
    : [null, null];
  return { ...cell, healthzStatus, readyzStatus, checkedAt: now.toISOString() };
}

// ---- reading sources ---------------------------------------------------------------

export function readRegister(path) {
  if (!existsSync(path)) throw new Error(`${path} not found (run scripts/generate-register.mjs first)`);
  const json = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(json.rows)) throw new Error(`${path} has no rows array`);
  return json;
}

/** Cell files from tin-boss-api. Returns { cells, errors }: one bad file does not hide the others. */
export async function loadCells(fetchFn, token) {
  const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github.raw+json", "x-github-api-version": "2022-11-28" };
  const listing = await fetchFn(CELLS_API, { headers: { ...headers, accept: "application/vnd.github+json" } });
  if (!listing.ok) throw new Error(`listing cells/ failed: HTTP ${listing.status}`);
  const entries = (await listing.json()).filter((e) => e.type === "file" && e.name.endsWith(".json"));
  const cells = [];
  const errors = [];
  for (const e of entries) {
    try {
      const res = await fetchFn(e.url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cells.push(parseCell(e.name, await res.json()));
    } catch (err) {
      errors.push(`cell file ${e.name}: ${err.message}`);
    }
  }
  return { cells, errors };
}

// ---- orchestration -----------------------------------------------------------------

/** One failing source never fails the run: it becomes "partial" with the error and whatever else was gathered. */
export async function collect({ readRegisterFn, loadCellsFn, fetchFn, now = new Date() }) {
  const errors = [];
  let packages = [];
  let cells = [];
  try {
    packages = packageSnapshots(await readRegisterFn());
  } catch (err) {
    errors.push(`packages: ${err.message}`);
  }
  try {
    const loaded = await loadCellsFn();
    errors.push(...loaded.errors);
    cells = await Promise.all(loaded.cells.map((c) => checkCell(c, fetchFn, now)));
  } catch (err) {
    errors.push(`cells: ${err.message}`);
  }
  const gathered = packages.length + cells.length;
  const runStatus = gathered === 0 ? "failed" : errors.length ? "partial" : "ok";
  return { packages, cells, errors, status: runStatus };
}

// ---- persistence -------------------------------------------------------------------

/** casts: { columnName: "jsonb" } adds a ::type cast to that column's placeholder. */
function insertMany(table, columns, rows, casts = {}) {
  const params = [];
  const tuples = rows.map((row) => `(${row.map((v, i) => {
    params.push(v);
    const cast = casts[columns[i]];
    return `$${params.length}${cast ? `::${cast}` : ""}`;
  }).join(", ")})`);
  return { text: `insert into ${table} (${columns.join(", ")}) values ${tuples.join(", ")}`, params };
}

/**
 * db = { run(text, params) -> rows, batch(statements) -> runs them in one transaction }.
 * Writes a run row, then the snapshots and the run's final status together, so a half-written
 * run is never marked ok. Prunes runs older than RETENTION_DAYS (snapshots cascade).
 */
export async function persist(db, result) {
  const [{ id }] = await db.run("insert into collector_runs default values returning id", []);
  const error = result.errors.length ? result.errors.join("\n").slice(0, 4000) : null;
  const statements = [];
  if (result.packages.length) {
    statements.push(insertMany("package_snapshots", ["run_id", "package", "repo", "branch_version", "latest", "next", "divergence", "dependents"],
      result.packages.map((p) => [id, p.package, p.repo, p.branchVersion, p.latest, p.next, p.divergence, JSON.stringify(p.dependents)]),
      { dependents: "jsonb" }));
  }
  if (result.cells.length) {
    statements.push(insertMany("cell_snapshots", ["run_id", "cell", "client", "ring", "region", "url", "healthz_status", "readyz_status", "checked_at"],
      result.cells.map((c) => [id, c.cell, c.client, c.ring, c.region, c.url, c.healthzStatus, c.readyzStatus, c.checkedAt])));
  }
  statements.push({ text: "update collector_runs set status = $2, finished_at = now(), error = $3 where id = $1", params: [id, result.status, error] });
  try {
    await db.batch(statements);
  } catch (err) {
    await db.run("update collector_runs set status = 'failed', finished_at = now(), error = $2 where id = $1", [id, `write failed: ${err.message}`.slice(0, 4000)]).catch(() => {});
    throw err;
  }
  await db.run(`delete from collector_runs where started_at < now() - interval '${RETENTION_DAYS} days'`, []);
  return id;
}

// ---- CLI ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const registerPath = args.includes("--register") ? args[args.indexOf("--register") + 1] : join(ROOT, "REGISTER.json");
  const url = process.env.NEON_COLLECTOR_URL;
  if (!dryRun && !url) {
    console.log("::warning::NEON_COLLECTOR_URL is not set; skipping the status collector.");
    return;
  }
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    console.error("collect-status: GITHUB_TOKEN is not set (needs read access to tindevelopers/tin-boss-api)");
    process.exit(1);
  }
  const result = await collect({ readRegisterFn: () => readRegister(registerPath), loadCellsFn: () => loadCells(fetch, token), fetchFn: fetch });
  if (dryRun) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const { neon } = await import("@neondatabase/serverless"); // loaded lazily: tests and --dry-run never need it
    const sql = neon(url);
    const db = { run: (text, params) => sql.query(text, params), batch: (stmts) => sql.transaction(stmts.map((s) => sql.query(s.text, s.params))) };
    const id = await persist(db, result);
    console.log(`Recorded collector run ${id}: ${result.status}; ${result.packages.length} packages, ${result.cells.length} cells.`);
  }
  for (const e of result.errors) console.error(`::warning::${e}`);
  if (result.status === "failed") process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(`collect-status: ${e.message}`); process.exit(1); });
