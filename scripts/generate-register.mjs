#!/usr/bin/env node
// scripts/generate-register.mjs
//
// T12 (Shared Hubs Baseline, Milestone 3 — Registry truth): cross-hub
// register. Discovers every @tindevelopers/* package published from a hub
// repo's packages/*/package.json (via the GitHub API), queries the real npm
// registry for each package's actual latest/next dist-tags, cross-references
// dependents (which other discovered packages declare a dependency on it,
// and what range), and flags divergence between a package's default-branch
// version and the registry's `latest`.
//
// Emits REGISTER.md at the repo root. Exits 1 (fails CI) when it finds a
// BACKWARD divergence — the registry's `latest` is a version the default
// branch's source does not reflect (the T9 adapter-kit / T11 knowledge
// pattern: history was squashed or two dev lines both published, and the
// registry now knows about work `main` doesn't) — unless that exact
// divergence is already recorded in known-divergences.json. A FORWARD
// divergence (branch ahead of registry — ordinary unreleased work) or an
// unpublished package (no registry versions yet) is never a failure.
//
// Requires:
//   GITHUB_TOKEN / GH_TOKEN   — read access to every repo in hubs.json
//   NODE_AUTH_TOKEN           — read access to https://npm.pkg.github.com
//
// Usage: node scripts/generate-register.mjs [--out REGISTER.md]

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const REGISTRY = "https://npm.pkg.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;

function fail(message) {
  console.error(`generate-register: ${message}`);
  process.exit(1);
}

function ghApi(path) {
  const url = `https://api.github.com${path}`;
  const args = [
    "-sS",
    "-H",
    "Accept: application/vnd.github+json",
    "-H",
    "X-GitHub-Api-Version: 2022-11-28",
  ];
  if (GITHUB_TOKEN) args.push("-H", `Authorization: Bearer ${GITHUB_TOKEN}`);
  args.push(url);
  const out = execFileSync("curl", args, { encoding: "utf8" });
  const json = JSON.parse(out);
  if (json && json.message && json.documentation_url && !Array.isArray(json)) {
    // GitHub error payloads look like { message, documentation_url }.
    // A real file-contents response also has "message" only for symlinks/
    // submodules, so only treat this as an error when status-shaped fields
    // (no "type"/"content" and no array) are present.
    if (!("type" in json) && !("content" in json)) {
      throw new Error(`GitHub API ${path}: ${json.message}`);
    }
  }
  return json;
}

function ghFileJson(owner, repo, path) {
  const entry = ghApi(`/repos/${owner}/${repo}/contents/${path}`);
  const buf = Buffer.from(entry.content, entry.encoding ?? "base64");
  return JSON.parse(buf.toString("utf8"));
}

function ghDirList(owner, repo, path) {
  const entries = ghApi(`/repos/${owner}/${repo}/contents/${path}`);
  if (!Array.isArray(entries)) return [];
  return entries.filter((e) => e.type === "dir").map((e) => e.name);
}

/** Read-only registry lookup. `@>=0.0.0` resolves even when no `latest`
 * dist-tag exists yet (see check-release-target.mjs / select-publishable-
 * packages.mjs in shell-base-admin for the same qualifier and why a bare
 * package name silently no-ops). E404 (never published) is a valid state,
 * not a tooling failure. */
function npmView(pkgName) {
  let stdout;
  try {
    stdout = execFileSync(
      "npm",
      ["view", `${pkgName}@>=0.0.0`, "versions", "dist-tags", "time", "--json", `--registry=${REGISTRY}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (stderr.includes("E404")) return { versions: [], distTags: {}, time: {} };
    throw new Error(`npm view ${pkgName} failed: ${stderr.trim().split("\n")[0]}`);
  }
  if (!stdout.trim()) return { versions: [], distTags: {}, time: {} };
  const parsed = JSON.parse(stdout);
  const doc = Array.isArray(parsed) ? parsed[0] : parsed;
  return {
    versions: doc?.versions ?? [],
    distTags: doc?.["dist-tags"] ?? {},
    time: doc?.time ?? {},
  };
}

function compareSemver(a, b) {
  const pa = a.split(/[.-]/).map((x) => (Number.isNaN(Number(x)) ? x : Number(x)));
  const pb = b.split(/[.-]/).map((x) => (Number.isNaN(Number(x)) ? x : Number(x)));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    return String(x).localeCompare(String(y));
  }
  return 0;
}

function main() {
  const hubs = JSON.parse(readFileSync(join(ROOT, "hubs.json"), "utf8"));
  const known = JSON.parse(readFileSync(join(ROOT, "known-divergences.json"), "utf8"));
  const knownByPkg = new Map(known.entries.map((e) => [e.package, e]));

  // ---- 1. Discover every package across every hub repo ----------------------
  const packages = new Map(); // name -> { name, repo, directory, version, deps: [{name, range, section}] }
  for (const { owner, repo } of hubs.repos) {
    let dirs;
    try {
      dirs = ghDirList(owner, repo, "packages");
    } catch (error) {
      fail(`could not list packages/ in ${owner}/${repo}: ${error.message}`);
    }
    for (const dir of dirs) {
      let manifest;
      try {
        manifest = ghFileJson(owner, repo, `packages/${dir}/package.json`);
      } catch {
        continue; // no readable package.json — not a publishing package
      }
      if (!manifest.name || !manifest.name.startsWith("@tindevelopers/") || !manifest.version) continue;
      const deps = [];
      for (const section of ["dependencies", "peerDependencies", "devDependencies"]) {
        for (const [depName, range] of Object.entries(manifest[section] ?? {})) {
          if (depName.startsWith("@tindevelopers/") && depName !== manifest.name) {
            deps.push({ name: depName, range: String(range), section });
          }
        }
      }
      packages.set(manifest.name, {
        name: manifest.name,
        repo: `${owner}/${repo}`,
        directory: `packages/${dir}`,
        version: manifest.version,
        deps,
      });
    }
  }
  if (packages.size === 0) fail("discovered zero @tindevelopers/* packages — check hubs.json and GitHub access");

  // ---- 2. Invert deps into a dependents map ----------------------------------
  const dependentsOf = new Map(); // name -> [{ by, range, section }]
  for (const pkg of packages.values()) {
    for (const dep of pkg.deps) {
      if (!dependentsOf.has(dep.name)) dependentsOf.set(dep.name, []);
      const slot = dependentsOf.get(dep.name);
      // A package can declare the same range in two sections (e.g. a
      // peerDependency mirrored into devDependencies for local dev) — that's
      // one real relationship, not two, so dedupe on (by, range).
      if (!slot.some((d) => d.by === pkg.name && d.range === dep.range)) {
        slot.push({ by: pkg.name, range: dep.range, section: dep.section });
      }
    }
  }

  // ---- 3. Query the real registry for every discovered package name ---------
  const registryErrors = [];
  for (const pkg of packages.values()) {
    try {
      const view = npmView(pkg.name);
      pkg.registryVersions = view.versions;
      pkg.registryLatest = view.distTags.latest ?? null;
      pkg.registryNext = view.distTags.next ?? null;
    } catch (error) {
      registryErrors.push(`${pkg.name}: ${error.message}`);
      pkg.registryVersions = null;
      pkg.registryLatest = undefined;
      pkg.registryNext = undefined;
    }
  }
  if (registryErrors.length) {
    fail(`registry unreadable for ${registryErrors.length} package(s) — auth/network broken, not a divergence:\n  ${registryErrors.join("\n  ")}`);
  }

  // ---- 4. Classify divergence -------------------------------------------------
  const unexplained = [];
  for (const pkg of packages.values()) {
    if (!pkg.registryLatest) {
      pkg.divergence = "OK (unpublished — no registry versions yet)";
      continue;
    }
    const cmp = compareSemver(pkg.registryLatest, pkg.version);
    if (cmp > 0) {
      // Registry latest is AHEAD of the branch — the dangerous pattern.
      const allow = knownByPkg.get(pkg.name);
      if (allow && allow.registryLatest === pkg.registryLatest) {
        pkg.divergence = `KNOWN DRIFT (allowlisted): registry latest ${pkg.registryLatest} > branch ${pkg.version} — ${allow.reason}`;
      } else {
        pkg.divergence = `UNEXPLAINED: registry latest ${pkg.registryLatest} is AHEAD of the default branch (${pkg.version}) — branch's source does not reflect a published version`;
        unexplained.push(pkg);
      }
    } else if (cmp < 0) {
      if (pkg.registryNext && compareSemver(pkg.registryNext, pkg.version) === 0) {
        pkg.divergence = `OK (forward — ${pkg.version} published to "next", awaiting G2 promotion to "latest")`;
      } else {
        pkg.divergence = `OK (forward — branch ${pkg.version} ahead of registry latest ${pkg.registryLatest}, unreleased)`;
      }
    } else {
      pkg.divergence = "OK";
    }
    // next-vs-latest staleness note (informational, never a failure): next
    // set but pointing at something OLDER than latest is a stale/moved-
    // backward next tag, worth a human look even though it isn't the
    // branch-vs-latest hazard this script fails closed on.
    if (pkg.registryNext && compareSemver(pkg.registryNext, pkg.registryLatest) < 0) {
      pkg.divergence += ` [note: "next" (${pkg.registryNext}) is BEHIND "latest" (${pkg.registryLatest})]`;
    }
  }

  // ---- 5. Konnect's own pin-consistency signal (best-effort) ------------------
  // check-hub-package-pins.mjs lives in konnect-caas-base and checks THAT
  // repo's internal consistency (catalog vs pnpm.overrides vs consumer
  // pins) — it says nothing about the registry directly, so it is included
  // as a separate informational section, not folded into the divergence
  // classification above. See README.md "Konnect signal" for how this is
  // produced (an optional CI step writes konnect-pin-check.txt before this
  // script runs) and the gap when that step can't run.
  let konnectSection = "_Not available this run — see README.md “Konnect signal” for the gap._";
  const konnectOutputPath = join(ROOT, "konnect-pin-check.txt");
  if (existsSync(konnectOutputPath)) {
    konnectSection = "```\n" + readFileSync(konnectOutputPath, "utf8").trim() + "\n```";
  }

  // ---- 6. Emit REGISTER.md ----------------------------------------------------
  const rows = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name));
  const lines = [];
  lines.push("# REGISTER.md");
  lines.push("");
  lines.push(`Generated ${new Date().toISOString()} by \`scripts/generate-register.mjs\` (T12, Shared Hubs Baseline, Milestone 3 — Registry truth).`);
  lines.push("");
  lines.push(
    "Compares every discovered `@tindevelopers/*` package's default-branch version against the real `latest`/`next` dist-tags on the private registry (`https://npm.pkg.github.com`). A **backward** divergence — registry `latest` ahead of the branch's version — is the dangerous pattern found the hard way in T9 (`adapter-kit`) and T11 (`knowledge`): it means the branch's source does not reflect a version that was actually published, usually from two dev lines both publishing after a history-squashing event. A **forward** divergence (branch ahead of `latest`) is ordinary unreleased work and is never flagged as a problem.",
  );
  lines.push("");
  lines.push("| Package | Repo | Branch version | Registry `latest` | Registry `next` | Dependents (range) | Divergence |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const pkg of rows) {
    const dependents = (dependentsOf.get(pkg.name) ?? [])
      .map((d) => `${d.by}@\`${d.range}\``)
      .sort()
      .join("<br>") || "—";
    lines.push(
      `| \`${pkg.name}\` | ${pkg.repo} | ${pkg.version} | ${pkg.registryLatest ?? "—"} | ${pkg.registryNext ?? "—"} | ${dependents} | ${pkg.divergence} |`,
    );
  }
  lines.push("");
  lines.push("## Konnect's own pin-consistency signal");
  lines.push("");
  lines.push(
    "`konnect-caas-base`'s `scripts/check-hub-package-pins.mjs` checks that repo's own three pin locations (the `catalog:` block in `pnpm-workspace.yaml`, `pnpm.overrides`, and every literal consumer pin) agree with each other. It says nothing about whether those pins match this register's `latest` — Konnect intentionally stays behind until its own staged-upgrade tasks (T14–T16) run — so this is reported separately, informationally, and never affects the exit code above.",
  );
  lines.push("");
  lines.push(konnectSection);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Packages discovered: ${rows.length}, across ${hubs.repos.length} hub repos.`);
  lines.push(`- Unexplained backward divergences: ${unexplained.length}${unexplained.length ? " — " + unexplained.map((p) => p.name).join(", ") : ""}.`);
  lines.push(`- Known/allowlisted backward divergences: ${known.entries.length ? known.entries.map((e) => e.package).join(", ") : "none"}.`);
  lines.push("");
  writeFileSync(join(ROOT, "REGISTER.md"), lines.join("\n") + "\n");
  console.log(`Wrote REGISTER.md: ${rows.length} packages, ${unexplained.length} unexplained divergence(s).`);

  if (unexplained.length > 0) {
    console.error("\n✘ unexplained backward divergence(s):");
    for (const pkg of unexplained) {
      console.error(`  - ${pkg.name}: branch ${pkg.version}, registry latest ${pkg.registryLatest}`);
    }
    console.error("\nInvestigate (T9/T11-style) and either fix the branch or add a reviewed entry to known-divergences.json. Never edit that file just to make this pass.");
    process.exit(1);
  }
}

main();
