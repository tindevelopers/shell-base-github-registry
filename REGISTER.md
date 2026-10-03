# REGISTER.md

Generated 2026-10-03T06:50:07.482Z by `scripts/generate-register.mjs` (T12, Shared Hubs Baseline, Milestone 3 — Registry truth).

Compares every discovered `@tindevelopers/*` package's default-branch version against the real `latest`/`next` dist-tags on the private registry (`https://npm.pkg.github.com`). A **backward** divergence — registry `latest` ahead of the branch's version — is the dangerous pattern found the hard way in T9 (`adapter-kit`) and T11 (`knowledge`): it means the branch's source does not reflect a version that was actually published, usually from two dev lines both publishing after a history-squashing event. A **forward** divergence (branch ahead of `latest`) is ordinary unreleased work and is never flagged as a problem.

| Package | Repo | Branch version | Registry `latest` | Registry `next` | Dependents (range) | Divergence |
|---|---|---|---|---|---|---|
| `@tindevelopers/adapter-kit` | tindevelopers/shared-integration-hub | 1.12.2 | 1.12.2 | 1.12.2 | @tindevelopers/adapter-pennylane@`^1.11.0`<br>@tindevelopers/adapter-pennylane@`^1.12.1`<br>@tindevelopers/adapter-quickbooks@`^1.11.0`<br>@tindevelopers/adapter-quickbooks@`^1.12.1`<br>@tindevelopers/adapter-shopify@`^1.11.0`<br>@tindevelopers/adapter-shopify@`^1.12.1`<br>@tindevelopers/adapter-stripe@`^1.11.0`<br>@tindevelopers/adapter-stripe@`^1.12.1`<br>@tindevelopers/adapter-woocommerce@`^1.11.0`<br>@tindevelopers/adapter-woocommerce@`^1.12.1`<br>@tindevelopers/adapter-xero@`^1.11.0`<br>@tindevelopers/adapter-xero@`^1.12.1`<br>@tindevelopers/agents@`^1.4.0`<br>@tindevelopers/boss@`^1.7.0`<br>@tindevelopers/comms@`^1.4.4`<br>@tindevelopers/domain-campaigns@`^1.9.1`<br>@tindevelopers/domain-contacts@`^1.9.1`<br>@tindevelopers/domain-finance@`1.12.1`<br>@tindevelopers/domain-finance@`^1.12.1`<br>@tindevelopers/domain-platform-billing@`1.12.1`<br>@tindevelopers/domain-platform-billing@`^1.12.1`<br>@tindevelopers/domain-support@`^1.0.0`<br>@tindevelopers/domain-support@`^1.9.1`<br>@tindevelopers/knowledge@`^1.8.0`<br>@tindevelopers/meetings@`^1.4.0` | OK |
| `@tindevelopers/adapter-pennylane` | tindevelopers/shared-integration-hub | 1.0.0-next.1 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/adapter-quickbooks` | tindevelopers/shared-integration-hub | 1.0.0-next.0 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/adapter-shopify` | tindevelopers/shared-integration-hub | 1.0.0-next.0 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/adapter-stripe` | tindevelopers/shared-integration-hub | 1.0.0-next.0 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/adapter-woocommerce` | tindevelopers/shared-integration-hub | 1.0.0-next.0 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/adapter-xero` | tindevelopers/shared-integration-hub | 1.0.0-next.0 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/agents` | tindevelopers/shell-base-agents | 2.0.0 | 2.0.0 | 2.0.0 | — | OK |
| `@tindevelopers/api-credentials` | tindevelopers/shared-api-hub | 0.3.0 | 0.2.0 | 0.3.0 | @tindevelopers/api-mcp@`>=0.2.0 <0.4.0` | OK (forward — 0.3.0 published to "next", awaiting G2 promotion to "latest") |
| `@tindevelopers/api-mcp` | tindevelopers/shared-api-hub | 1.0.0 | 0.2.1 | 1.0.0 | — | OK (forward — 1.0.0 published to "next", awaiting G2 promotion to "latest") |
| `@tindevelopers/boss` | tindevelopers/shell-base-boss | 0.1.2 | 0.1.2 | 0.1.2 | — | OK |
| `@tindevelopers/brands` | tindevelopers/chassis | 0.2.0 | 0.2.0 | — | @tindevelopers/ui-consumer@`workspace:^` | OK |
| `@tindevelopers/comms` | tindevelopers/shell-base-cxp | 3.1.0 | 3.1.0 | 3.1.0 | — | OK |
| `@tindevelopers/core-kernel` | tindevelopers/shell-base-admin | 3.0.0 | 3.0.0 | 3.0.0 | @tindevelopers/adapter-kit@`^1.1.0 || ^2.0.0 || ^3.0.0`<br>@tindevelopers/adapter-kit@`^3.0.0`<br>@tindevelopers/agents@`^1.0.0 || ^2.0.0`<br>@tindevelopers/agents@`^2.2.0`<br>@tindevelopers/comms@`^1.0.0 || ^2.0.0`<br>@tindevelopers/comms@`^2.2.0`<br>@tindevelopers/domain-campaigns@`^1.0.0 || ^2.0.0 || ^3.0.0`<br>@tindevelopers/domain-contacts@`^1.0.0 || ^2.0.0 || ^3.0.0`<br>@tindevelopers/domain-support@`^2.0.0`<br>@tindevelopers/knowledge@`^1.0.1 || ^2.0.0`<br>@tindevelopers/meetings@`^1.0.0 || ^2.0.0`<br>@tindevelopers/meetings@`^2.2.0`<br>@tindevelopers/platform@`^3.0.0` | OK |
| `@tindevelopers/credential-crypto` | tindevelopers/shared-integration-hub | 1.0.0 | 1.0.0 | 1.0.0 | @tindevelopers/core-kernel@`^1.0.0`<br>@tindevelopers/domain-contacts@`^1.0.0`<br>@tindevelopers/domain-email@`^1.0.0`<br>@tindevelopers/domain-finance@`1.0.0`<br>@tindevelopers/domain-finance@`^1.0.0`<br>@tindevelopers/domain-platform-billing@`1.0.0`<br>@tindevelopers/domain-platform-billing@`^1.0.0` | OK |
| `@tindevelopers/design-tokens` | tindevelopers/chassis | 0.1.0 | 0.1.0 | — | @tindevelopers/brands@`workspace:^`<br>@tindevelopers/ui-consumer@`workspace:^` | OK |
| `@tindevelopers/domain-billing` | tindevelopers/shell-base-admin | 1.0.2 | 1.0.2 | 1.0.2 | — | OK |
| `@tindevelopers/domain-campaigns` | tindevelopers/shared-client-care-hub | 1.1.1 | 1.1.0 | 1.1.1 | — | OK (forward — 1.1.1 published to "next", awaiting G2 promotion to "latest") |
| `@tindevelopers/domain-chatbot` | tindevelopers/shell-base-admin | 1.0.1 | 1.0.1 | 1.0.1 | — | OK |
| `@tindevelopers/domain-contacts` | tindevelopers/shared-client-care-hub | 1.2.1 | 1.2.0 | 1.2.1 | — | OK (forward — 1.2.1 published to "next", awaiting G2 promotion to "latest") |
| `@tindevelopers/domain-control-plane` | tindevelopers/shell-base-admin | 1.2.0 | 1.2.0 | 1.2.0 | — | OK |
| `@tindevelopers/domain-control-plane-client` | tindevelopers/shell-base-admin | 0.1.0 | 0.1.0 | 0.1.0 | — | OK |
| `@tindevelopers/domain-email` | tindevelopers/shell-base-admin | 1.0.1 | 1.0.1 | 1.0.1 | — | OK |
| `@tindevelopers/domain-finance` | tindevelopers/shell-base-finance | 1.0.0-next.0 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/domain-identity` | tindevelopers/shared-identity-hub | 2.3.0 | 2.3.0 | 2.3.0 | @tindevelopers/core-kernel@`^2.0.0`<br>@tindevelopers/domain-billing@`^2.0.0`<br>@tindevelopers/domain-campaigns@`^1.1.0 || ^2.0.0`<br>@tindevelopers/domain-chatbot@`^2.0.0`<br>@tindevelopers/domain-contacts@`^1.1.0 || ^2.0.0`<br>@tindevelopers/domain-control-plane@`^2.1.1`<br>@tindevelopers/domain-email@`^2.0.0`<br>@tindevelopers/platform@`^2.0.0` | OK |
| `@tindevelopers/domain-pipeline` | tindevelopers/shared-client-care-hub | 1.2.0 | — | 1.2.0 | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/domain-platform-billing` | tindevelopers/shell-base-finance | 1.0.0-next.0 | — | — | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/domain-support` | tindevelopers/shared-client-care-hub | 6.0.0 | 6.0.0 | 6.0.0 | — | OK |
| `@tindevelopers/domain-translation` | tindevelopers/shell-base-cxp | 1.0.0 | 1.0.0 | — | — | OK |
| `@tindevelopers/knowledge` | tindevelopers/shell-base-knowledge | 0.3.1 | 0.4.0 | — | — | KNOWN DRIFT (allowlisted): registry latest 0.4.0 > branch 0.3.1 — T11 finding (Milestone 2 retrospective, 2026-09-23): three-version drift from an org-wide history-squashing event; one of the three drifted versions (0.2.0 or 0.3.0's true source) is genuinely unrecoverable. Investigated and accepted as KNOWN; a full reconciliation to 0.4.0 is out of scope for T12 and not yet scheduled. |
| `@tindevelopers/meetings` | tindevelopers/shell-base-meetings | 2.0.0 | 2.0.0 | 2.0.0 | — | OK |
| `@tindevelopers/platform` | tindevelopers/shell-base-admin | 1.4.2 | 1.4.2 | 1.4.2 | — | OK |
| `@tindevelopers/schema-crm` | tindevelopers/shared-client-care-hub | 1.2.0 | 1.2.0 | 1.2.0 | @tindevelopers/domain-campaigns@`workspace:^`<br>@tindevelopers/domain-contacts@`workspace:^`<br>@tindevelopers/domain-pipeline@`workspace:^`<br>@tindevelopers/ui-crm@`workspace:^` | OK |
| `@tindevelopers/schema-finance` | tindevelopers/shell-base-finance | 1.0.0-next.0 | — | — | @tindevelopers/domain-finance@`^1.0.0-next.0`<br>@tindevelopers/domain-platform-billing@`^1.0.0-next.0` | OK (unpublished — no registry versions yet) |
| `@tindevelopers/schema-identity` | tindevelopers/shared-identity-hub | 1.1.1 | 1.1.1 | 1.1.1 | @tindevelopers/core-kernel@`^1.0.0`<br>@tindevelopers/domain-identity@`^1.0.0`<br>@tindevelopers/domain-identity@`^1.1.1`<br>@tindevelopers/domain-support@`^1.1.1`<br>@tindevelopers/schema-finance@`^1.0.0` | OK |
| `@tindevelopers/schema-support` | tindevelopers/shared-client-care-hub | 1.0.0 | — | 1.0.0 | — | OK (unpublished — no registry versions yet) |
| `@tindevelopers/ui-consumer` | tindevelopers/chassis | 0.2.0 | 0.2.0 | — | — | OK |
| `@tindevelopers/ui-crm` | tindevelopers/shared-client-care-hub | 1.0.0 | 1.0.0 | 1.0.0 | — | OK |
| `@tindevelopers/ui-shell` | tindevelopers/shell-base-admin | 1.2.0 | 1.2.0 | 1.2.0 | — | OK |

## Konnect's own pin-consistency signal

`konnect-caas-base`'s `scripts/check-hub-package-pins.mjs` checks that repo's own three pin locations (the `catalog:` block in `pnpm-workspace.yaml`, `pnpm.overrides`, and every literal consumer pin) agree with each other. It says nothing about whether those pins match this register's `latest` — Konnect intentionally stays behind until its own staged-upgrade tasks (T14–T16) run — so this is reported separately, informationally, and never affects the exit code above.

```
hub-package pin check
---------------------
catalog entries (26):
  @tindevelopers/adapter-kit@1.9.1
  @tindevelopers/agents@2.0.0
  @tindevelopers/api-credentials@0.3.0
  @tindevelopers/api-mcp@0.1.0
  @tindevelopers/boss@0.1.1
  @tindevelopers/comms@3.0.0
  @tindevelopers/core-kernel@3.0.0
  @tindevelopers/credential-crypto@1.0.0
  @tindevelopers/domain-billing@1.0.2
  @tindevelopers/domain-campaigns@1.1.1
  @tindevelopers/domain-chatbot@1.0.1
  @tindevelopers/domain-contacts@1.2.1
  @tindevelopers/domain-control-plane@1.0.3
  @tindevelopers/domain-control-plane-client@0.1.0
  @tindevelopers/domain-email@1.0.1
  @tindevelopers/domain-identity@2.3.0
  @tindevelopers/domain-pipeline@1.2.0
  @tindevelopers/domain-support@5.1.0
  @tindevelopers/domain-translation@1.0.0
  @tindevelopers/knowledge@0.3.1
  @tindevelopers/meetings@2.0.0
  @tindevelopers/platform@1.4.2
  @tindevelopers/schema-crm@1.2.0
  @tindevelopers/schema-identity@1.1.1
  @tindevelopers/ui-crm@1.0.0
  @tindevelopers/ui-shell@1.2.0
pnpm.overrides entries (26):
  @tindevelopers/adapter-kit@1.9.1
  @tindevelopers/agents@2.0.0
  @tindevelopers/api-credentials@0.3.0
  @tindevelopers/api-mcp@0.1.0
  @tindevelopers/boss@0.1.1
  @tindevelopers/comms@3.0.0
  @tindevelopers/core-kernel@3.0.0
  @tindevelopers/credential-crypto@1.0.0
  @tindevelopers/domain-billing@1.0.2
  @tindevelopers/domain-campaigns@1.1.1
  @tindevelopers/domain-chatbot@1.0.1
  @tindevelopers/domain-contacts@1.2.1
  @tindevelopers/domain-control-plane@1.0.3
  @tindevelopers/domain-control-plane-client@0.1.0
  @tindevelopers/domain-email@1.0.1
  @tindevelopers/domain-identity@2.3.0
  @tindevelopers/domain-pipeline@1.2.0
  @tindevelopers/domain-support@5.1.0
  @tindevelopers/domain-translation@1.0.0
  @tindevelopers/knowledge@0.3.1
  @tindevelopers/meetings@2.0.0
  @tindevelopers/platform@1.4.2
  @tindevelopers/schema-crm@1.2.0
  @tindevelopers/schema-identity@1.1.1
  @tindevelopers/ui-crm@1.0.0
  @tindevelopers/ui-shell@1.2.0
consumer pins (25 underlying packages):
  @tindevelopers/adapter-kit@1.9.1  via [@base/integrations]  in 4 files
  @tindevelopers/agents@2.0.0  via [@base/agents, @tindevelopers/agents]  in 4 files
  @tindevelopers/api-credentials@0.3.0  via [@base/api-credentials, @tindevelopers/api-credentials]  in 1 files
  @tindevelopers/api-mcp@0.1.0  via [@base/api-mcp]  in 1 files
  @tindevelopers/boss@0.1.1  via [@base/boss]  in 1 files
  @tindevelopers/comms@3.0.0  via [@tindevelopers/comms]  in 4 files
  @tindevelopers/core-kernel@3.0.0  via [@base/core]  in 4 files
  @tindevelopers/credential-crypto@1.0.0  via [@tindevelopers/credential-crypto]  in 2 files
  @tindevelopers/domain-billing@1.0.2  via [@tindevelopers/domain-billing]  in 2 files
  @tindevelopers/domain-campaigns@1.1.1  via [@base/campaigns]  in 2 files
  @tindevelopers/domain-chatbot@1.0.1  via [@tindevelopers/domain-chatbot]  in 1 files
  @tindevelopers/domain-contacts@1.2.1  via [@base/contacts]  in 2 files
  @tindevelopers/domain-control-plane@1.0.3  via [@base/control-plane]  in 4 files
  @tindevelopers/domain-control-plane-client@0.1.0  via [@tindevelopers/domain-control-plane-client]  in 1 files
  @tindevelopers/domain-email@1.0.1  via [@tindevelopers/domain-email]  in 3 files
  @tindevelopers/domain-identity@2.3.0  via [@tindevelopers/domain-identity]  in 4 files
  @tindevelopers/domain-pipeline@1.2.0  via [@base/pipeline]  in 3 files
  @tindevelopers/domain-support@5.1.0  via [@base/support]  in 4 files
  @tindevelopers/domain-translation@1.0.0  via [@base/translation]  in 4 files
  @tindevelopers/knowledge@0.3.1  via [@base/knowledge]  in 3 files
  @tindevelopers/meetings@2.0.0  via [@base/meetings, @tindevelopers/meetings]  in 4 files
  @tindevelopers/platform@1.4.2  via [@tindevelopers/platform]  in 2 files
  @tindevelopers/schema-identity@1.1.1  via [@tindevelopers/schema-identity]  in 2 files
  @tindevelopers/ui-crm@1.0.0  via [@base/ui-crm]  in 2 files
  @tindevelopers/ui-shell@1.2.0  via [@base/ui-shell]  in 4 files

✓ all pins are consistent across catalog + pnpm.overrides + consumers.
```

## Summary

- Packages discovered: 39, across 12 hub repos.
- Unexplained backward divergences: 0.
- Known/allowlisted backward divergences: @tindevelopers/knowledge.

