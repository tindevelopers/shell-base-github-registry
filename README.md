# shell-base-github-registry

Cross-hub registry-truth report for every `@tindevelopers/*` package. This is
**T12** of the [Shared Hubs Baseline](https://github.com/tindevelopers/shell-base-admin/blob/main/docs/plans/2026-09-22-shared-hubs-baseline.md)
program's Milestone 3 ("Registry truth").

## What this repo is

Every `@tindevelopers/*` package is developed in one of nine hub repos
(`hubs.json`) and published to the private npm registry at
`https://npm.pkg.github.com`. Each hub tracks its own package versions
independently on its own default branch — nothing here enforces that a hub's
branch and the registry agree. Milestone 2 found, twice, by accident (T9's
`adapter-kit`, T11's `knowledge`), that they can quietly disagree: a package's
default branch can fall behind a version the registry actually has, usually
because two development lines both published after an org-wide
history-squashing event. This repo makes that drift visible automatically,
every day, for every package — not just the ones a task happens to be
touching.

## How to read REGISTER.md

[`REGISTER.md`](./REGISTER.md) is generated, not hand-written — every edit to
it is overwritten by the next run. Its table has one row per discovered
package:

| Column | Meaning |
|---|---|
| Package | The `@tindevelopers/*` name |
| Repo | Which hub repo owns it |
| Branch version | The `version` field in that hub's `packages/<name>/package.json` on its default branch |
| Registry `latest` / `next` | The real dist-tags on `https://npm.pkg.github.com` right now |
| Dependents | Every other discovered package that declares a dependency on this one, and the exact range it uses |
| Divergence | `OK` (including ordinary unreleased forward drift, and a package not yet published at all), `KNOWN DRIFT (allowlisted)` (a backward divergence someone has already investigated — see `known-divergences.json`), or `UNEXPLAINED` |

**Backward** divergence (registry `latest` is a *higher* version than the
branch) is the dangerous case: the branch's source does not reflect a version
that was actually published. **Forward** divergence (branch ahead of
`latest`) is normal — it just means that work hasn't been released yet — and
is never flagged as a problem.

## How this runs

- `.github/workflows/register.yml` runs daily (also on `workflow_dispatch`,
  and on a push that touches the script/config), regenerates `REGISTER.md`,
  and **commits it straight to `main`** — there is no source code here to
  review in a PR, only a generated report, so a daily PR-per-run would be
  pure process noise. It **fails the run** (non-zero exit) when it finds a
  backward divergence that is not already recorded in
  `known-divergences.json`, per the program's V3.1 acceptance criterion
  ("register generated in CI, zero unexplained divergences"). The commit
  step still runs (and still pushes the current findings) even when the
  comparison step failed, so the committed file always matches what that run
  actually found.
- `.github/workflows/ci.yml` runs the same comparison read-only on every PR
  against this repo (e.g. a change to the script or the allowlist), without
  committing, so a change is verified before it lands.
- To run it locally: `pnpm install && GITHUB_TOKEN=<a token with read access
  to the hub repos> NODE_AUTH_TOKEN=<a token with read access to
  npm.pkg.github.com> pnpm register`.

## `known-divergences.json`

A backward divergence never gets waved through silently — it either fails CI,
or it's in this file with a name, date, and a reason, the same discipline
`shell-base-admin/release-targets.json`'s `knownDrift` list applies to
publish-time drift. **Never add an entry here just to make a new finding
stop failing CI.** An entry is added only after the drift has actually been
investigated (the way T9 investigated `adapter-kit` and T11 investigated
`knowledge`) and a human/orchestrator has decided it's accepted, not a bug to
fix now.

Currently allowlisted: `@tindevelopers/knowledge` (registry `latest` 0.4.0
vs. its default branch's 0.3.1) — the T11 finding: three-version drift from
an org-wide history-squash, one version's true source genuinely
unrecoverable. See the Milestone 2 retrospective in
`shell-base-admin/docs/plans/2026-09-22-shared-hubs-baseline.md`.

## Konnect signal

`konnect-caas-base`'s `scripts/check-hub-package-pins.mjs` checks that repo's
own three pin locations (`pnpm-workspace.yaml`'s `catalog:` block,
`pnpm.overrides`, and every literal consumer pin) agree with each other. It
doesn't compare against this register's `latest` — Konnect intentionally
stays behind the registry until its own staged-upgrade tasks (T14–T16) run —
so its output is included in `REGISTER.md` as a separate, informational
section and never affects this repo's CI outcome.

**Known gap:** running that script needs a checkout of `konnect-caas-base`,
which needs a token with read access to a repo other than this one — the
default per-repo `GITHUB_TOKEN` can't reach it. `register.yml` looks for a
secret named `HUB_REGISTRY_ORG_READ_TOKEN` (a classic or fine-grained PAT
with read access to `tindevelopers/konnect-caas-base`) and skips that step
entirely if it isn't set, rather than failing the whole run over an
informational extra. As of this writing that secret has not been configured,
so `REGISTER.md`'s Konnect section reports the gap instead of real output —
same shape of gap T8/T10 hit for `NODE_AUTH_TOKEN`, flagged here rather than
worked around.

## Known gap: `NODE_AUTH_TOKEN`

Both workflows need a `NODE_AUTH_TOKEN`-equivalent repository secret — a
token with read access to `https://npm.pkg.github.com` — to run `pnpm
install` and to query the registry. This is the same gap this program hit at
T8 and T10: if this repo does not yet have that secret configured, every run
of `register.yml` and `ci.yml` fails at the install/query step with something
like `ERR_PNPM_FETCH_401`, not because of a real registry divergence. Add a
secret named `NODE_AUTH_TOKEN` (Settings → Secrets and variables → Actions)
before relying on the scheduled run.

## Scope

Discovery (`hubs.json`) currently covers the nine hub repos named in the
Shared Hubs Baseline plan: `shell-base-admin`, `shared-integration-hub`,
`shared-api-hub`, `shell-base-crm`, `shell-base-cxp`, `shell-base-knowledge`,
`shell-base-boss`, `shell-base-meetings`, `shell-base-agents`. An org-wide
code search for `"@tindevelopers/"` under a `packages/` path also matched
three other repos — `chassis`, `notarized-platform-v1`,
`great-western-bed-and-breakfast` — that are not part of this hub-and-spoke
program and that this repo's own GitHub access cannot read; they are
deliberately left out of `hubs.json` rather than guessed at. If any of them
turns out to actually publish `@tindevelopers/*` packages, add it to
`hubs.json` after confirming with the orchestrator.

Deprecating any package, moving a dist-tag, or reconciling
`@tindevelopers/knowledge`'s drift is **not** this repo's job — see T13 in
the Shared Hubs Baseline plan (its own G3 human-authorization gate).
