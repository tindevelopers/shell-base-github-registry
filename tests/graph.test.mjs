// node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { satisfies, compareVersions, buildGraph, findCycles } from "../scripts/generate-graph.mjs";

test("satisfies: ranges seen in the hubs", () => {
  assert.equal(satisfies("3.0.0", "^1.0.0 || ^2.0.0"), false);
  assert.equal(satisfies("3.0.0", "^1.0.0 || ^2.0.0 || ^3.0.0"), true);
  assert.equal(satisfies("0.3.0", ">=0.2.0 <0.4.0"), true);
  assert.equal(satisfies("1.0.0", ">=0.2.0 <0.4.0"), false);
  assert.equal(satisfies("1.12.2", "^1.9.1"), true);
  assert.equal(satisfies("1.9.0", "^1.9.1"), false);
  assert.equal(satisfies("2.1.1", "^2.1.1"), true);
  assert.equal(satisfies("0.2.5", "^0.2.3"), true);
  assert.equal(satisfies("0.3.0", "^0.2.3"), false);
  assert.equal(satisfies("1.4.9", "1.x"), true);
  assert.equal(satisfies("2.0.0", "1.x"), false);
  assert.equal(satisfies("1.2.9", "~1.2.3"), true);
  assert.equal(satisfies("1.3.0", "~1.2.3"), false);
  assert.equal(satisfies("1.0.0-next.0", "^1.12.1"), false);
  assert.equal(satisfies("1.0.0-next.1", "^1.0.0-next.0"), true);
});

test("satisfies: cannot-tell cases return null", () => {
  assert.equal(satisfies("1.0.0", "workspace:^"), null);
  assert.equal(satisfies("1.0.0", "npm:@x/y@1.0.0"), null);
  assert.equal(satisfies("not-a-version", "^1.0.0"), null);
});

test("compareVersions orders prereleases below releases", () => {
  assert.ok(compareVersions("1.0.0-next.1", "1.0.0") < 0);
  assert.ok(compareVersions("1.0.0-next.2", "1.0.0-next.10") < 0);
  assert.ok(compareVersions("2.3.0", "2.1.1") > 0);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
});

const m = (hub, dir, manifest) => ({ hub, dir, manifest: { name: `@tindevelopers/${dir}`, version: "1.0.0", ...manifest } });

test("buildGraph: duplicate name keeps the highest version and flags the copy", () => {
  const g = buildGraph([
    m("hub-a", "ident", { version: "2.3.0" }),
    m("hub-b", "ident", { version: "2.1.1" }),
    m("hub-b", "billing", { dependencies: { "@tindevelopers/ident": "^2.0.0" } }),
  ]);
  const stale = g.packages.find((p) => p.stale);
  assert.equal(stale.id, "@tindevelopers/ident@hub-b");
  assert.equal(g.edges.find((e) => e.from === "@tindevelopers/billing").to, "@tindevelopers/ident");
  assert.ok(g.findings.some((f) => f.id === "duplicate-package:@tindevelopers/ident"));
});

test("buildGraph: a declared owner beats version order", () => {
  const g = buildGraph(
    [m("hub-a", "ident", { version: "2.3.0" }), m("hub-b", "ident", { version: "2.3.0" }), m("hub-b", "billing", { dependencies: { "@tindevelopers/ident": "^2.0.0" } })],
    { "@tindevelopers/ident": "hub-b" },
  );
  assert.equal(g.packages.find((p) => p.stale).hub, "hub-a");
  assert.equal(g.hubEdges.length, 0);
});

test("buildGraph: a range that excludes the current version is a high finding", () => {
  const g = buildGraph([
    m("hub-a", "kernel", { version: "3.0.0" }),
    m("hub-b", "comms", { peerDependencies: { "@tindevelopers/kernel": "^1.0.0 || ^2.0.0" } }),
    m("hub-b", "agents", { peerDependencies: { "@tindevelopers/kernel": "^1.0.0 || ^2.0.0 || ^3.0.0" } }),
  ]);
  const f = g.findings.find((x) => x.id === "range-excludes-current:@tindevelopers/kernel");
  assert.ok(f && f.severity === "high");
  assert.match(f.detail, /comms/);
  assert.doesNotMatch(f.detail, /agents/);
});

test("buildGraph: hubs that depend on each other form a cycle; dev deps are ignored", () => {
  const g = buildGraph([
    m("hub-a", "kernel", { dependencies: { "@tindevelopers/crypto": "^1.0.0" } }),
    m("hub-b", "crypto", {}),
    m("hub-b", "kit", { peerDependencies: { "@tindevelopers/kernel": "^1.0.0" } }),
    m("hub-b", "tool", { devDependencies: { "@tindevelopers/kernel": "^1.0.0" } }),
  ]);
  assert.deepEqual(g.cycles, [["hub-a", "hub-b"]]);
  assert.ok(g.findings.some((f) => f.id.startsWith("hub-cycle:")));
  assert.equal(g.edges.some((e) => e.from === "@tindevelopers/tool"), false);
});

test("findCycles: acyclic graphs report nothing", () => {
  assert.deepEqual(findCycles([{ from: "a", to: "b" }, { from: "b", to: "c" }]), []);
});

test("buildGraph: unresolved internal dependencies are recorded, not dropped", () => {
  const g = buildGraph([m("hub-a", "x", { dependencies: { "@tindevelopers/missing": "^1.0.0" } })]);
  assert.equal(g.unresolved.length, 1);
});
