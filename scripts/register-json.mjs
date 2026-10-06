// scripts/register-json.mjs
//
// Machine-readable twin of REGISTER.md. Built from the same `rows` and
// `dependentsOf` that generate-register.mjs renders to markdown, so the two
// cannot disagree. Consumed by scripts/collect-status.mjs.

export function toRegisterJson(rows, dependentsOf, generatedAt) {
  return {
    generatedAt,
    rows: rows.map((pkg) => ({
      package: pkg.name,
      repo: pkg.repo,
      branchVersion: pkg.version ?? null,
      latest: pkg.registryLatest ?? null,
      next: pkg.registryNext ?? null,
      dependents: (dependentsOf.get(pkg.name) ?? [])
        .map((d) => ({ by: d.by, range: d.range }))
        .sort((a, b) => a.by.localeCompare(b.by) || a.range.localeCompare(b.range)),
      divergence: pkg.divergence,
    })),
  };
}
