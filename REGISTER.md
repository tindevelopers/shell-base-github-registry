# REGISTER.md

Generated 2026-09-24T06:26:41.125Z by `scripts/generate-register.mjs` (T12, Shared Hubs Baseline, Milestone 3 — Registry truth).

Compares every discovered `@tindevelopers/*` package's default-branch version against the real `latest`/`next` dist-tags on the private registry (`https://npm.pkg.github.com`). A **backward** divergence — registry `latest` ahead of the branch's version — is the dangerous pattern found the hard way in T9 (`adapter-kit`) and T11 (`knowledge`): it means the branch's source does not reflect a version that was actually published, usually from two dev lines both publishing after a history-squashing event. A **forward** divergence (branch ahead of `latest`) is ordinary unreleased work and is never flagged as a problem.

| Package | Repo | Branch version | Registry `latest` | Registry `next` | Dependents (range) | Divergence |
|---|---|---|---|---|---|---|
| `@tindevelopers/adapter-kit` | tindevelopers/shared-integration-hub | 1.11.0 | 1.10.0 | — | @tindevelopers/agents@`^1.0.0`<br>@tindevelopers/boss@`^1.7.0`<br>@tindevelopers/comms@`^1.4.4`<br>@tindevelopers/domain-campaigns@`^1.3.0`<br>@tindevelopers/domain-contacts@`^1.5.0`<br>@tindevelopers/domain-support@`^1.0.0`<br>@tindevelopers/knowledge@`^1.8.0`<br>@tindevelopers/meetings@`^1.0.0` | OK (forward — branch 1.11.0 ahead of registry latest 1.10.0, unreleased) |
| `@tindevelopers/agents` | tindevelopers/shell-base-agents | 1.2.0 | 1.1.0 | — | — | OK (forward — branch 1.2.0 ahead of registry latest 1.1.0, unreleased) |
| `@tindevelopers/api-credentials` | tindevelopers/shared-api-hub | 0.2.0 | 0.2.0 | — | @tindevelopers/api-mcp@`^0.2.0` | OK |
| `@tindevelopers/api-mcp` | tindevelopers/shared-api-hub | 0.2.0 | 0.2.0 | — | — | OK |
| `@tindevelopers/boss` | tindevelopers/shell-base-boss | 0.1.1 | 0.1.1 | — | — | OK |
| `@tindevelopers/comms` | tindevelopers/shell-base-cxp | 2.2.0 | 2.1.1 | — | — | OK (forward — branch 2.2.0 ahead of registry latest 2.1.1, unreleased) |
| `@tindevelopers/core-kernel` | tindevelopers/shell-base-admin | 2.2.0 | 2.2.0 | 2.2.0 | @tindevelopers/adapter-kit@`^1.1.0 || ^2.0.0`<br>@tindevelopers/adapter-kit@`^2.2.0`<br>@tindevelopers/agents@`^1.0.0 || ^2.0.0`<br>@tindevelopers/agents@`^2.2.0`<br>@tindevelopers/comms@`^1.0.0 || ^2.0.0`<br>@tindevelopers/comms@`^2.2.0`<br>@tindevelopers/domain-campaigns@`^1.0.0`<br>@tindevelopers/domain-contacts@`^1.0.0`<br>@tindevelopers/domain-control-plane@`^2.0.0`<br>@tindevelopers/domain-support@`^2.0.0`<br>@tindevelopers/knowledge@`^1.0.1 || ^2.0.0`<br>@tindevelopers/meetings@`^1.0.0 || ^2.0.0`<br>@tindevelopers/meetings@`^2.2.0`<br>@tindevelopers/platform@`^2.0.0` | OK |
| `@tindevelopers/domain-campaigns` | tindevelopers/shell-base-crm | 1.1.0 | 1.0.0 | — | — | OK (forward — branch 1.1.0 ahead of registry latest 1.0.0, unreleased) |
| `@tindevelopers/domain-contacts` | tindevelopers/shell-base-crm | 1.2.0 | 1.1.0 | — | — | OK (forward — branch 1.2.0 ahead of registry latest 1.1.0, unreleased) |
| `@tindevelopers/domain-control-plane` | tindevelopers/shell-base-admin | 1.0.0 | 1.0.0 | — | — | OK |
| `@tindevelopers/domain-identity` | tindevelopers/shell-base-admin | 1.0.0 | 1.0.0 | 1.0.0 | @tindevelopers/core-kernel@`^1.0.0` | OK |
| `@tindevelopers/domain-support` | tindevelopers/shell-base-admin | 2.0.1 | 2.0.1 | 2.0.1 | — | OK |
| `@tindevelopers/domain-translation` | tindevelopers/shell-base-cxp | 1.0.0 | 1.0.0 | — | — | OK |
| `@tindevelopers/knowledge` | tindevelopers/shell-base-knowledge | 0.3.1 | 0.4.0 | — | — | KNOWN DRIFT (allowlisted): registry latest 0.4.0 > branch 0.3.1 — T11 finding (Milestone 2 retrospective, 2026-09-23): three-version drift from an org-wide history-squashing event; one of the three drifted versions (0.2.0 or 0.3.0's true source) is genuinely unrecoverable. Investigated and accepted as KNOWN; a full reconciliation to 0.4.0 is out of scope for T12 and not yet scheduled. |
| `@tindevelopers/meetings` | tindevelopers/shell-base-meetings | 1.2.0 | 1.1.0 | — | — | OK (forward — branch 1.2.0 ahead of registry latest 1.1.0, unreleased) |
| `@tindevelopers/platform` | tindevelopers/shell-base-admin | 1.3.0 | 1.2.0 | 1.3.0 | — | OK (forward — 1.3.0 published to "next", awaiting G2 promotion to "latest") |
| `@tindevelopers/schema-crm` | tindevelopers/shell-base-crm | 1.1.0 | 1.0.0 | — | @tindevelopers/domain-campaigns@`workspace:^`<br>@tindevelopers/domain-contacts@`workspace:^`<br>@tindevelopers/ui-crm@`workspace:^` | OK (forward — branch 1.1.0 ahead of registry latest 1.0.0, unreleased) |
| `@tindevelopers/schema-identity` | tindevelopers/shell-base-admin | 1.0.0 | 1.0.0 | 1.0.0 | @tindevelopers/core-kernel@`^1.0.0`<br>@tindevelopers/domain-identity@`^1.0.0` | OK |
| `@tindevelopers/ui-crm` | tindevelopers/shell-base-crm | 1.0.0 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/ui-shell` | tindevelopers/shell-base-admin | 1.1.0 | 1.1.0 | 1.1.0 | — | OK |

## Konnect's own pin-consistency signal

`konnect-caas-base`'s `scripts/check-hub-package-pins.mjs` checks that repo's own three pin locations (the `catalog:` block in `pnpm-workspace.yaml`, `pnpm.overrides`, and every literal consumer pin) agree with each other. It says nothing about whether those pins match this register's `latest` — Konnect intentionally stays behind until its own staged-upgrade tasks (T14–T16) run — so this is reported separately, informationally, and never affects the exit code above.

```
hub-package pin check
---------------------
catalog entries (16):
  @tindevelopers/adapter-kit@1.9.1
  @tindevelopers/agents@1.1.0
  @tindevelopers/api-credentials@0.1.0
  @tindevelopers/api-mcp@0.1.0
  @tindevelopers/boss@0.1.1
  @tindevelopers/comms@2.1.1
  @tindevelopers/core-kernel@1.1.0
  @tindevelopers/domain-campaigns@1.0.0
  @tindevelopers/domain-contacts@1.1.0
  @tindevelopers/domain-control-plane@1.0.0
  @tindevelopers/domain-support@1.0.0
  @tindevelopers/domain-translation@1.0.0
  @tindevelopers/meetings@1.1.0
  @tindevelopers/platform@1.2.0
  @tindevelopers/schema-crm@1.0.0
  @tindevelopers/ui-shell@1.0.0
pnpm.overrides entries (16):
  @tindevelopers/adapter-kit@1.9.1
  @tindevelopers/agents@1.1.0
  @tindevelopers/api-credentials@0.1.0
  @tindevelopers/api-mcp@0.1.0
  @tindevelopers/boss@0.1.1
  @tindevelopers/comms@2.1.1
  @tindevelopers/core-kernel@1.1.0
  @tindevelopers/domain-campaigns@1.0.0
  @tindevelopers/domain-contacts@1.1.0
  @tindevelopers/domain-control-plane@1.0.0
  @tindevelopers/domain-support@1.0.0
  @tindevelopers/domain-translation@1.0.0
  @tindevelopers/meetings@1.1.0
  @tindevelopers/platform@1.2.0
  @tindevelopers/schema-crm@1.0.0
  @tindevelopers/ui-shell@1.0.0
consumer pins (15 underlying packages):
  @tindevelopers/adapter-kit@1.9.1  via [@base/integrations]  in 4 files
  @tindevelopers/agents@1.1.0  via [@tindevelopers/agents]  in 4 files
  @tindevelopers/api-credentials@0.1.0  via [@base/api-credentials, @tindevelopers/api-credentials]  in 1 files
  @tindevelopers/api-mcp@0.1.0  via [@base/api-mcp]  in 1 files
  @tindevelopers/boss@0.1.1  via [@base/boss]  in 1 files
  @tindevelopers/comms@2.1.1  via [@tindevelopers/comms]  in 4 files
  @tindevelopers/core-kernel@1.1.0  via [@base/core]  in 4 files
  @tindevelopers/domain-campaigns@1.0.0  via [@base/campaigns]  in 2 files
  @tindevelopers/domain-contacts@1.1.0  via [@base/contacts]  in 2 files
  @tindevelopers/domain-control-plane@1.0.0  via [@base/control-plane]  in 4 files
  @tindevelopers/domain-support@1.0.0  via [@base/support]  in 4 files
  @tindevelopers/domain-translation@1.0.0  via [@base/translation]  in 4 files
  @tindevelopers/meetings@1.1.0  via [@tindevelopers/meetings]  in 4 files
  @tindevelopers/platform@1.2.0  via [@tindevelopers/platform]  in 2 files
  @tindevelopers/ui-shell@1.0.0  via [@base/ui-shell]  in 4 files

✓ all pins are consistent across catalog + pnpm.overrides + consumers.
```

## Summary

- Packages discovered: 20, across 9 hub repos.
- Unexplained backward divergences: 0.
- Known/allowlisted backward divergences: @tindevelopers/knowledge.

