#!/usr/bin/env node
// scripts/generate-graph.mjs
//
// Cross-hub dependency graph. Where generate-register.mjs answers "does each
// hub's branch agree with the registry?", this script answers "how do the hubs
// and packages depend on each other, and where is that structure unhealthy?".
//
// It discovers every @tindevelopers/* package in every hub in hubs.json (via
// the GitHub API, default branch), builds the package-to-package graph from
// dependencies, peerDependencies and optionalDependencies, rolls it up to a
// hub-to-hub graph, and emits:
//
//   GRAPH.json  machine-readable: packages, edges, hub edges, metrics, findings
//   GRAPH.md    human summary of the same data
//
// Findings it can compute generically (no repo-specific knowledge):
//   range-excludes-current  an internal dependency/peer range does not
//                           accept the version the target has on its branch
//   duplicate-package       one package name is published from two hubs
//   hub-cycle               hubs that depend on each other (directly or not)
//   gravity-well            a package with many dependents (informational)
//   prerelease-package      packages whose version is a prerelease
//
// Branch versions only: it does not query the npm registry. generate-register
// already compares branch and registry. The graph describes the source.
//
// Requires:
//   GITHUB_TOKEN / GH_TOKEN   read access to every repo in hubs.json
//
// Usage:
//   node scripts/generate-graph.mjs [--out-json GRAPH.json] [--out-md GRAPH.md]
//   node scripts/generate-graph.mjs --manifests dump.json     (offline replay)
//   node scripts/generate-graph.mjs --save-manifests dump.json (keep the raw input)
//
// Optional graph-owners.json: { "owners": { "@tindevelopers/<pkg>": "<hub repo>" } }
// declares which hub owns a package that is (temporarily) published from two.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SCOPE = "@tindevelopers/";
const SECTIONS = {
  dependencies: "dep",
  peerDependencies: "peer",
  optionalDependencies: "optional",
  devDependencies: "dev",
};
const RUNTIME = new Set(["dep", "peer", "optional"]);
const GRAVITY_THRESHOLD = 8;

// ---------------------------------------------------------------------------
// Semver (stdlib only). Supports exact, ^, ~, x-ranges, >= > <= < =, spaces
// (AND) and || (OR), which covers every range seen in the hubs. Anything else
// (workspace:, file:, npm: aliases) returns null = "cannot tell".
// ---------------------------------------------------------------------------

export function parseVersion(text) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(String(text).trim());
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ? m[4].split(".") : [] };
}

export function compareVersions(a, b) {
  const x = typeof a === "string" ? parseVersion(a) : a;
  const y = typeof b === "string" ? parseVersion(b) : b;
  if (!x || !y) return 0;
  for (const k of ["major", "minor", "patch"]) if (x[k] !== y[k]) return x[k] - y[k];
  if (!x.pre.length && !y.pre.length) return 0;
  if (!x.pre.length) return 1;
  if (!y.pre.length) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pn = /^\d+$/.test(p);
    const qn = /^\d+$/.test(q);
    if (pn && qn) {
      if (+p !== +q) return +p - +q;
    } else if (pn) return -1;
    else if (qn) return 1;
    else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

function partial(text) {
  const m = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?$/.exec(text);
  if (!m) return null;
  const n = (s) => (s === undefined || /^[xX*]$/.test(s) ? null : +s);
  return { major: n(m[1]), minor: n(m[2]), patch: n(m[3]), pre: m[4] ? m[4].split(".") : [] };
}

const V = (major, minor, patch, pre = []) => ({ major, minor, patch, pre });

function expand(token) {
  let m = /^(\^|~|>=|<=|>|<|=)?(.+)$/.exec(token);
  if (!m) return null;
  const op = m[1] ?? "";
  const p = partial(m[2]);
  if (!p) return null;
  if (p.major === null) return [];
  const { major, minor, patch, pre } = p;
  const lo = V(major, minor ?? 0, patch ?? 0, pre);
  if (op === "^") {
    let hi;
    if (major > 0 || minor === null) hi = V(major + 1, 0, 0);
    else if (minor > 0 || patch === null) hi = V(0, minor + 1, 0);
    else hi = V(0, 0, patch + 1);
    return [{ op: ">=", v: lo }, { op: "<", v: hi }];
  }
  if (op === "~") {
    const hi = minor === null ? V(major + 1, 0, 0) : V(major, minor + 1, 0);
    return [{ op: ">=", v: lo }, { op: "<", v: hi }];
  }
  if (op === ">=") return [{ op: ">=", v: lo }];
  if (op === "<") return [{ op: "<", v: lo }];
  if (op === ">") {
    if (patch !== null) return [{ op: ">", v: lo }];
    return [{ op: ">=", v: minor !== null ? V(major, minor + 1, 0) : V(major + 1, 0, 0) }];
  }
  if (op === "<=") {
    if (patch !== null) return [{ op: "<=", v: lo }];
    return [{ op: "<", v: minor !== null ? V(major, minor + 1, 0) : V(major + 1, 0, 0) }];
  }
  // bare or "=": exact when fully specified, otherwise an x-range
  if (patch !== null) return [{ op: "=", v: lo }];
  const hi = minor !== null ? V(major, minor + 1, 0) : V(major + 1, 0, 0);
  return [{ op: ">=", v: lo }, { op: "<", v: hi }];
}

function test(v, { op, v: w }) {
  const c = compareVersions(v, w);
  return op === ">=" ? c >= 0 : op === ">" ? c > 0 : op === "<=" ? c <= 0 : op === "<" ? c < 0 : c === 0;
}

function satisfiesSet(v, set) {
  const tokens = set.replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1").split(/\s+/).filter(Boolean);
  const comps = [];
  for (const t of tokens) {
    const e = expand(t);
    if (e === null) return null;
    comps.push(...e);
  }
  if (!comps.every((c) => test(v, c))) return false;
  if (v.pre.length) {
    // a prerelease only satisfies a range that names the same x.y.z prerelease
    return comps.some((c) => c.v.pre.length && c.v.major === v.major && c.v.minor === v.minor && c.v.patch === v.patch);
  }
  return true;
}

/** true / false, or null when the range cannot be evaluated (workspace:, aliases, junk). */
export function satisfies(version, range) {
  const v = parseVersion(version);
  if (!v) return null;
  const r = String(range).trim();
  if (/^(workspace:|file:|link:|npm:|git|https?:)/.test(r)) return null;
  if (r === "" || r === "*" || r === "latest") return v.pre.length === 0;
  let unknown = false;
  for (const set of r.split("||")) {
    const res = satisfiesSet(v, set.trim());
    if (res === true) return true;
    if (res === null) unknown = true;
  }
  return unknown ? null : false;
}

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

/**
 * @param {{hub:string, dir:string, manifest:object}[]} manifests
 *   one entry per packages/<dir>/package.json found in a hub
 * @param {Record<string,string>} [owners]
 *   optional package name -> owning hub. When a name is published from more
 *   than one hub, the declared owner is canonical; otherwise the highest
 *   version wins (ties go to the first hub seen).
 */
export function buildGraph(manifests, owners = {}) {
  const entries = [];
  for (const { hub, dir, manifest } of manifests) {
    if (!manifest?.name || !manifest.name.startsWith(SCOPE)) continue;
    const links = [];
    for (const [section, kind] of Object.entries(SECTIONS)) {
      for (const [name, range] of Object.entries(manifest[section] ?? {})) {
        if (name.startsWith(SCOPE)) links.push({ name, range, section: kind });
      }
    }
    const ext = (s) => Object.keys(manifest[s] ?? {}).filter((n) => !n.startsWith(SCOPE)).sort();
    entries.push({
      name: manifest.name,
      hub,
      dir,
      version: manifest.version ?? "0.0.0",
      private: Boolean(manifest.private),
      exports: manifest.exports && typeof manifest.exports === "object" ? Object.keys(manifest.exports).length : manifest.exports ? 1 : 0,
      links,
      external: { dependencies: ext("dependencies"), peerDependencies: ext("peerDependencies"), optionalDependencies: ext("optionalDependencies") },
    });
  }

  // A name published from two hubs: the declared owner (graph-owners.json) or else the highest version is canonical; the rest are stale copies.
  const byName = new Map();
  for (const e of entries) byName.set(e.name, [...(byName.get(e.name) ?? []), e]);
  const canonical = new Map();
  for (const [name, list] of byName) {
    const declared = list.find((e) => e.hub === owners[name]);
    const best = declared ?? [...list].sort((a, b) => compareVersions(b.version, a.version))[0];
    canonical.set(name, best);
    for (const e of list) e.stale = e !== best;
  }
  for (const e of entries) e.id = e.stale ? `${e.name}@${e.hub}` : e.name;

  const edges = [];
  const unresolved = [];
  for (const e of entries) {
    for (const link of e.links) {
      if (!RUNTIME.has(link.section)) continue;
      const target = canonical.get(link.name);
      if (!target) {
        unresolved.push({ from: e.id, to: link.name, range: link.range, section: link.section });
        continue;
      }
      edges.push({
        from: e.id,
        to: target.id,
        section: link.section,
        range: link.range,
        satisfiedByBranch: satisfies(target.version, link.range),
      });
    }
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.section.localeCompare(b.section));

  const hubOf = new Map(entries.map((e) => [e.id, e.hub]));
  const fanInSets = new Map();
  for (const ed of edges) fanInSets.set(ed.to, new Set([...(fanInSets.get(ed.to) ?? []), ed.from]));
  const fanIn = Object.fromEntries([...fanInSets].map(([k, v]) => [k, v.size]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));

  const hubEdgeMap = new Map();
  for (const ed of edges) {
    const a = hubOf.get(ed.from);
    const b = hubOf.get(ed.to);
    if (a === b) continue;
    const key = `${a}\u0000${b}`;
    const cur = hubEdgeMap.get(key) ?? { from: a, to: b, count: 0, via: [] };
    cur.count += 1;
    cur.via.push(`${ed.from} -> ${ed.to}`);
    hubEdgeMap.set(key, cur);
  }
  const hubEdges = [...hubEdgeMap.values()].sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const cycles = findCycles(hubEdges);

  const packages = entries
    .map((e) => ({
      id: e.id,
      name: e.name,
      hub: e.hub,
      dir: e.dir,
      version: e.version,
      private: e.private,
      stale: e.stale,
      prerelease: parseVersion(e.version)?.pre.length > 0,
      exports: e.exports,
      links: e.links,
      external: e.external,
    }))
    .sort((a, b) => a.hub.localeCompare(b.hub) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const hubs = [...new Set(packages.map((p) => p.hub))].sort().map((hub) => ({ hub, packages: packages.filter((p) => p.hub === hub).map((p) => p.id) }));

  const graph = { hubs, packages, edges, unresolved, hubEdges, cycles, metrics: { fanIn } };
  graph.findings = computeFindings(graph);
  return graph;
}

/** Strongly connected components of size > 1 in the hub graph (Tarjan). */
export function findCycles(hubEdges) {
  const adj = new Map();
  for (const { from, to } of hubEdges) {
    adj.set(from, [...(adj.get(from) ?? []), to]);
    if (!adj.has(to)) adj.set(to, []);
  }
  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const out = [];
  const visit = (v) => {
    idx.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) out.push(comp.sort());
    }
  };
  for (const v of [...adj.keys()].sort()) if (!idx.has(v)) visit(v);
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

function computeFindings(graph) {
  const findings = [];
  const pkg = new Map(graph.packages.map((p) => [p.id, p]));

  const byTarget = new Map();
  for (const ed of graph.edges) {
    if (ed.satisfiedByBranch !== false) continue;
    if (ed.section === "optional") continue;
    const target = pkg.get(ed.to);
    if (!target || target.prerelease) continue;
    byTarget.set(ed.to, [...(byTarget.get(ed.to) ?? []), ed]);
  }
  for (const [to, list] of [...byTarget].sort((a, b) => a[0].localeCompare(b[0]))) {
    findings.push({
      id: `range-excludes-current:${to}`,
      severity: "high",
      title: `${list.length} range${list.length === 1 ? "" : "s"} exclude ${to}@${pkg.get(to).version}`,
      detail: list.map((e) => `${e.from} (${e.section} ${e.range})`).join("; "),
      packages: [to, ...list.map((e) => e.from)],
    });
  }

  const dupes = new Map();
  for (const p of graph.packages) dupes.set(p.name, [...(dupes.get(p.name) ?? []), p]);
  for (const [name, list] of [...dupes].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (list.length < 2) continue;
    findings.push({
      id: `duplicate-package:${name}`,
      severity: "high",
      title: `${name} is published from ${list.length} hubs`,
      detail: list.map((p) => `${p.hub} ${p.version}${p.stale ? " (stale copy)" : " (canonical)"}`).join("; "),
      packages: list.map((p) => p.id),
    });
  }

  for (const comp of graph.cycles) {
    findings.push({
      id: `hub-cycle:${comp.join("+")}`,
      severity: "high",
      title: `Hubs depend on each other: ${comp.join(", ")}`,
      detail: graph.hubEdges.filter((h) => comp.includes(h.from) && comp.includes(h.to)).map((h) => `${h.from} -> ${h.to} (${h.count}: ${h.via.join(", ")})`).join("; "),
      packages: [],
    });
  }

  for (const [id, n] of Object.entries(graph.metrics.fanIn)) {
    if (n < GRAVITY_THRESHOLD) continue;
    findings.push({ id: `gravity-well:${id}`, severity: "info", title: `${id} has ${n} dependents`, detail: "A breaking change here is an estate-wide event.", packages: [id] });
  }

  const pre = graph.packages.filter((p) => p.prerelease && !p.stale);
  if (pre.length) {
    findings.push({ id: "prerelease-package", severity: "info", title: `${pre.length} prerelease package${pre.length === 1 ? "" : "s"}`, detail: pre.map((p) => `${p.name}@${p.version}`).join(", "), packages: pre.map((p) => p.id) });
  }

  const rank = { high: 0, medium: 1, info: 2 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export function renderMarkdown(graph, date) {
  const real = graph.packages.filter((p) => !p.stale);
  const lines = [];
  lines.push("# GRAPH.md");
  lines.push("");
  lines.push("<!-- Generated by scripts/generate-graph.mjs. Do not edit by hand; the next run overwrites this file. -->");
  lines.push("");
  lines.push(`Generated ${date} from each hub's default branch. Machine-readable twin: [GRAPH.json](GRAPH.json).`);
  lines.push("");
  lines.push(`**${real.length} packages** in **${graph.hubs.length} hubs**, **${graph.edges.length} package dependency edges**, ${graph.hubEdges.length} hub-to-hub links, ${graph.cycles.length} hub cycle${graph.cycles.length === 1 ? "" : "s"}, ${graph.packages.length - real.length} stale cop${graph.packages.length - real.length === 1 ? "y" : "ies"}.`);
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  if (!graph.findings.length) lines.push("None.");
  else {
    lines.push("| Severity | Finding | Detail |");
    lines.push("|---|---|---|");
    for (const f of graph.findings) lines.push(`| ${f.severity} | ${f.title} | ${f.detail.replace(/\|/g, "\\|")} |`);
  }
  lines.push("");
  lines.push("## Hub to hub");
  lines.push("");
  lines.push("| From hub | To hub | Edges | Through |");
  lines.push("|---|---|---|---|");
  for (const h of graph.hubEdges) lines.push(`| ${h.from} | ${h.to} | ${h.count} | ${h.via.slice(0, 4).join("; ")}${h.via.length > 4 ? `; +${h.via.length - 4} more` : ""} |`);
  lines.push("");
  lines.push("## Most depended on");
  lines.push("");
  lines.push("| Package | Dependents |");
  lines.push("|---|---|");
  for (const [id, n] of Object.entries(graph.metrics.fanIn).slice(0, 10)) lines.push(`| ${id} | ${n} |`);
  lines.push("");
  lines.push("## Packages by hub");
  lines.push("");
  for (const h of graph.hubs) {
    lines.push(`### ${h.hub}`);
    lines.push("");
    lines.push("| Package | Version | Depends on (in estate) |");
    lines.push("|---|---|---|");
    for (const id of h.packages) {
      const p = graph.packages.find((x) => x.id === id);
      const out = graph.edges.filter((e) => e.from === id).map((e) => `${e.to}${e.section === "peer" ? " (peer)" : ""}`);
      lines.push(`| ${p.id}${p.stale ? " (stale copy)" : ""} | ${p.version} | ${out.join(", ") || "none"} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// GitHub input
// ---------------------------------------------------------------------------

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

function fail(message) {
  console.error(`generate-graph: ${message}`);
  process.exit(1);
}

// Same transport as generate-register.mjs (curl), kept local so each script stays standalone.
function ghApi(path) {
  const args = ["-sS", "-H", "Accept: application/vnd.github+json", "-H", "X-GitHub-Api-Version: 2022-11-28"];
  if (GITHUB_TOKEN) args.push("-H", `Authorization: Bearer ${GITHUB_TOKEN}`);
  args.push(`https://api.github.com${path}`);
  const json = JSON.parse(execFileSync("curl", args, { encoding: "utf8" }));
  if (json && json.message && !Array.isArray(json) && !("type" in json) && !("content" in json)) {
    const error = new Error(`GitHub API ${path}: ${json.message}`);
    error.notFound = json.message === "Not Found";
    throw error;
  }
  return json;
}

function collectManifests(hubs) {
  const out = [];
  for (const { owner, repo } of hubs.repos) {
    let dirs;
    try {
      const entries = ghApi(`/repos/${owner}/${repo}/contents/packages`);
      dirs = Array.isArray(entries) ? entries.filter((e) => e.type === "dir").map((e) => e.name) : [];
    } catch (error) {
      fail(`could not list packages/ in ${owner}/${repo}: ${error.message}`);
    }
    for (const dir of dirs) {
      try {
        const entry = ghApi(`/repos/${owner}/${repo}/contents/packages/${dir}/package.json`);
        out.push({ hub: repo, dir, manifest: JSON.parse(Buffer.from(entry.content, entry.encoding ?? "base64").toString("utf8")) });
      } catch (error) {
        if (!error.notFound) fail(`could not read packages/${dir}/package.json in ${repo}: ${error.message}`);
      }
    }
  }
  return out;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
  const manifestsFile = arg("--manifests");
  const manifests = manifestsFile ? JSON.parse(readFileSync(manifestsFile, "utf8")) : collectManifests(JSON.parse(readFileSync(join(ROOT, "hubs.json"), "utf8")));
  if (!manifests.length) fail("discovered zero packages. Check hubs.json and GitHub access");
  if (arg("--save-manifests")) writeFileSync(arg("--save-manifests"), JSON.stringify(manifests, null, 2) + "\n");
  let owners = {};
  try {
    owners = JSON.parse(readFileSync(join(ROOT, "graph-owners.json"), "utf8")).owners ?? {};
  } catch {
    // optional file
  }
  const graph = buildGraph(manifests, owners);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(join(ROOT, arg("--out-json") ?? "GRAPH.json"), JSON.stringify({ generated: date, ...graph }, null, 2) + "\n");
  writeFileSync(join(ROOT, arg("--out-md") ?? "GRAPH.md"), renderMarkdown(graph, date) + "\n");
  const real = graph.packages.filter((p) => !p.stale).length;
  console.log(`Wrote GRAPH.json and GRAPH.md: ${real} packages, ${graph.edges.length} edges, ${graph.cycles.length} hub cycle(s), ${graph.findings.filter((f) => f.severity === "high").length} high finding(s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
