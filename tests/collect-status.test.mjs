// node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { toRegisterJson } from "../scripts/register-json.mjs";
import { checkCell, collect, isCloudRun, packageSnapshots, parseCell, persist } from "../scripts/collect-status.mjs";

const NOW = new Date("2026-10-06T07:00:00Z");

// ---- REGISTER.json ----------------------------------------------------------------

test("toRegisterJson carries every REGISTER.md column and sorts dependents", () => {
  const rows = [{ name: "@tindevelopers/a", repo: "tindevelopers/hub", version: "1.0.0", registryLatest: "1.0.0", registryNext: undefined, divergence: "OK" }];
  const dependentsOf = new Map([["@tindevelopers/a", [{ by: "@tindevelopers/z", range: "^1.0.0" }, { by: "@tindevelopers/b", range: "^1.0.0" }]]]);
  const json = toRegisterJson(rows, dependentsOf, "2026-10-06T07:00:00.000Z");
  assert.deepEqual(json.rows, [{
    package: "@tindevelopers/a", repo: "tindevelopers/hub", branchVersion: "1.0.0", latest: "1.0.0", next: null,
    dependents: [{ by: "@tindevelopers/b", range: "^1.0.0" }, { by: "@tindevelopers/z", range: "^1.0.0" }], divergence: "OK",
  }]);
});

// ---- cells ------------------------------------------------------------------------

test("parseCell uses the file name as the cell id and requires client, ring and region", () => {
  assert.deepEqual(parseCell("konnect-dev.json", { client: "konnect", ring: 0, region: "europe-west2" }),
    { cell: "konnect-dev", client: "konnect", ring: 0, region: "europe-west2", url: null });
  assert.throws(() => parseCell("x.json", { client: "k", region: "r" }), /ring/);
  assert.throws(() => parseCell("x.json", { ring: 0, region: "r" }), /client/);
});

const cell = { cell: "konnect-dev", client: "konnect", ring: 0, region: "europe-west2", url: "https://cell.example/" };

test("checkCell records the HTTP status of /healthz and /readyz", async () => {
  const seen = [];
  const fetchFn = async (u) => { seen.push(u); return { status: u.endsWith("/healthz") ? 200 : 503 }; };
  const r = await checkCell(cell, fetchFn, NOW);
  assert.deepEqual(seen.sort(), ["https://cell.example/healthz", "https://cell.example/readyz"]);
  assert.equal(r.healthzStatus, 200);
  assert.equal(r.readyzStatus, 503);
  assert.equal(r.checkedAt, NOW.toISOString());
});

test("checkCell: on Cloud Run only /readyz is called, because the frontend reserves /healthz", async () => {
  const seen = [];
  const run = { ...cell, url: "https://tin-boss-api-konnect-dev-hek4oupkra-nw.a.run.app" };
  const r = await checkCell(run, async (u) => { seen.push(u); return { status: 200 }; }, NOW);
  assert.deepEqual(seen, ["https://tin-boss-api-konnect-dev-hek4oupkra-nw.a.run.app/readyz"]);
  assert.equal(r.healthzStatus, null);
  assert.equal(r.readyzStatus, 200);
});

test("isCloudRun matches run.app hosts only", () => {
  assert.equal(isCloudRun("https://x-abc-nw.a.run.app"), true);
  assert.equal(isCloudRun("https://cell.example"), false);
  assert.equal(isCloudRun("https://notrun.app.example.com"), false);
  assert.equal(isCloudRun("not a url"), false);
});

test("checkCell: a network error is a null status, not a crash", async () => {
  const r = await checkCell(cell, async () => { throw new Error("ECONNREFUSED"); }, NOW);
  assert.equal(r.healthzStatus, null);
  assert.equal(r.readyzStatus, null);
});

test("checkCell: a cell with no url is kept with null statuses and makes no request", async () => {
  let calls = 0;
  const r = await checkCell({ ...cell, url: null }, async () => { calls++; return { status: 200 }; }, NOW);
  assert.equal(calls, 0);
  assert.equal(r.healthzStatus, null);
  assert.equal(r.url, null);
});

// ---- collect ----------------------------------------------------------------------

const register = { rows: [{ package: "@tindevelopers/a", repo: "r", branchVersion: "1.0.0", latest: "1.0.0", next: null, dependents: [], divergence: "OK" }] };
const ok200 = async () => ({ status: 200 });

test("collect: everything works -> ok", async () => {
  const r = await collect({ readRegisterFn: () => register, loadCellsFn: async () => ({ cells: [cell], errors: [] }), fetchFn: ok200, now: NOW });
  assert.equal(r.status, "ok");
  assert.equal(r.packages.length, 1);
  assert.equal(r.cells.length, 1);
});

test("collect: cells failing still records the packages, as partial", async () => {
  const r = await collect({ readRegisterFn: () => register, loadCellsFn: async () => { throw new Error("HTTP 403"); }, fetchFn: ok200, now: NOW });
  assert.equal(r.status, "partial");
  assert.equal(r.packages.length, 1);
  assert.match(r.errors[0], /cells: HTTP 403/);
});

test("collect: packages failing still records the cells, as partial", async () => {
  const r = await collect({ readRegisterFn: () => { throw new Error("REGISTER.json not found"); }, loadCellsFn: async () => ({ cells: [cell], errors: [] }), fetchFn: ok200, now: NOW });
  assert.equal(r.status, "partial");
  assert.equal(r.cells.length, 1);
});

test("collect: one bad cell file is reported but the good cells are kept", async () => {
  const r = await collect({ readRegisterFn: () => register, loadCellsFn: async () => ({ cells: [cell], errors: ["cell file bad.json: missing ring"] }), fetchFn: ok200, now: NOW });
  assert.equal(r.status, "partial");
  assert.equal(r.cells.length, 1);
});

test("collect: both sources failing is failed", async () => {
  const r = await collect({ readRegisterFn: () => { throw new Error("x"); }, loadCellsFn: async () => { throw new Error("y"); }, fetchFn: ok200, now: NOW });
  assert.equal(r.status, "failed");
});

// ---- persist ----------------------------------------------------------------------

function fakeDb({ failBatch = false } = {}) {
  const log = { runs: [], batches: [] };
  return {
    log,
    async run(text, params) { log.runs.push({ text, params }); return text.startsWith("insert into collector_runs") ? [{ id: 42 }] : []; },
    async batch(stmts) { if (failBatch) throw new Error("boom"); log.batches.push(stmts); },
  };
}

test("persist: run row, then snapshots and final status in one batch, then prune", async () => {
  const db = fakeDb();
  const result = await collect({ readRegisterFn: () => register, loadCellsFn: async () => ({ cells: [cell], errors: [] }), fetchFn: ok200, now: NOW });
  const id = await persist(db, result);
  assert.equal(id, 42);
  assert.match(db.log.runs[0].text, /^insert into collector_runs/);
  const [stmts] = db.log.batches;
  assert.equal(stmts.length, 3);
  assert.match(stmts[0].text, /insert into package_snapshots/);
  assert.match(stmts[0].text, /\$8::jsonb/);
  assert.equal(stmts[0].params[0], 42);
  assert.equal(stmts[0].params[7], "[]");
  assert.match(stmts[1].text, /insert into cell_snapshots/);
  assert.match(stmts[2].text, /update collector_runs set status/);
  assert.deepEqual(stmts[2].params, [42, "ok", null]);
  assert.match(db.log.runs.at(-1).text, /delete from collector_runs where started_at < now\(\) - interval '90 days'/);
});

test("persist: only the allow-listed columns are ever written", async () => {
  const db = fakeDb();
  await persist(db, { packages: packageSnapshots(register), cells: [{ ...cell, healthzStatus: 200, readyzStatus: 200, checkedAt: NOW.toISOString(), runtimeEnv: { SECRET: "x" } }], errors: [], status: "ok" });
  const cellInsert = db.log.batches[0].find((s) => s.text.includes("cell_snapshots"));
  assert.match(cellInsert.text, /\(run_id, cell, client, ring, region, url, healthz_status, readyz_status, checked_at\)/);
  assert.ok(!cellInsert.params.includes("x"), "cell file contents beyond the allow-list must never be written");
});

test("persist: a failed write marks the run failed and rethrows", async () => {
  const db = fakeDb({ failBatch: true });
  await assert.rejects(() => persist(db, { packages: packageSnapshots(register), cells: [], errors: [], status: "ok" }), /boom/);
  const last = db.log.runs.at(-1);
  assert.match(last.text, /status = 'failed'/);
  assert.match(last.params[1], /write failed: boom/);
});

test("persist: errors are stored on the run row", async () => {
  const db = fakeDb();
  await persist(db, { packages: packageSnapshots(register), cells: [], errors: ["cells: HTTP 403"], status: "partial" });
  assert.deepEqual(db.log.batches[0].at(-1).params, [42, "partial", "cells: HTTP 403"]);
});
