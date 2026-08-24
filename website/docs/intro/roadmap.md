---
sidebar_position: 4
title: Public roadmap
---

# Public roadmap

This page lists the major features Hortval ships progressively across versions, what drives each one, and which plan unlocks it. Subscribers on annual plans **lock the price** when they sign up — new features unlock on the same subscription as they ship.

The roadmap is a planning indication, not a contractual commitment. Versions and feature ordering may change based on customer feedback.

## What the number means

The version number says **what the product becomes**, not what the upgrade will
cost you.

| | What changes | What you do |
|---|---|---|
| `1.0.1` → `1.0.2` | fixes | replace the binary, restart |
| `1.0` → `1.1` | a capability, added | back up, replace, restart |
| `1.x` → `2.0` | a shape the product did not have: it splits, distributes, gains a console | the same three steps |

A major is therefore **neither a rewrite, nor a new licence, nor a migration
project**. Your licence covers every version, your ACME clients never change
because the interface is RFC 8555 and not our API, and from 1.0.0 onward no
release asks you to edit your configuration. See
[Versions and support](../administration/migrations.md#versions-and-support).

Legend: ✅ shipped · 🎯 next release in flight.

## Features by version

| Feature | Version | Plan(s) | Driver |
|---|---|---|---|
| ACME core (RFC 8555: account / order / authz / challenge / finalize / revoke) | 0.9 ✅ | All | Standard interop with any ACME client |
| ARI read-only (RFC 9773 `renewalInfo` endpoint) | 0.9 ✅ | All | Lets clients pick their own renewal window |
| HTTP-01 / DNS-01 / TLS-ALPN-01 challenges | 0.9 ✅ | All | Validation flexibility on every network topology |
| ADCS bridge via `certreq.exe` + built-in fake PKI for testing | 0.9 ✅ | All | Core promise: bridge ACME to your existing ADCS |
| SQLite (default), PostgreSQL and SQL Server backends | 0.9 ✅ | All / PostgreSQL and SQL Server on Pro+ | Operators pick the persistence they already operate |
| Tamper-evident audit log (JSONL + HMAC chain + `audit verify`) | 0.9 ✅ | All | Compliance and forensic without DB lock contention |
| SQLite backup CLI (`backup create` / `backup verify`) | 0.9 ✅ | All | Disaster recovery without a 3rd-party tool |
| License enforcement (strict boot + acknowledgement) | 0.9 ✅ | All | Predictable cost ceiling, no surprise billing |
| Graceful HTTP shutdown | 0.9 ✅ | All | Zero in-flight cert lost on `systemctl restart` |
| RFC 8555 `Location` headers audit complete | 0.9 ✅ | All | Conformance with strict-RFC ACME clients (NativeClient, Caddy) |
| Native ADCS connector (in-process enrollment by default — no `certreq.exe` child process; `certreq.exe` stays available as the `adcs-cli` fallback) | 0.9.2 ✅ | All | Removes the LOLBin process chain that strict EDRs flag (Defender for Endpoint, CrowdStrike, SentinelOne) — eligible for stricter deployment perimeters |
| Configuration validation (`hortval validate`, `nginx -t`-style) + fail-fast boot gate | 0.9.2 ✅ | All | Catch a bad configuration before startup, not halfway through |
| Real ADCS revocation (CRL / OCSP propagation) | 0.9.3 ✅ | All | A revoked certificate is actually revoked end-to-end |
| Configurable server-certificate key (RSA / ECDSA — e.g. RSA 4096 for RSA-only ADCS templates) | 0.9.3 ✅ | All | Start against CA templates that mandate a specific key type or size |
| ADCS setup preflight (`hortval adcs check` + guided `init`: template picker, key-requirement detection, clear denial reasons) | 0.9.3 ✅ | All | Diagnose ADCS onboarding before go-live — fewer support tickets at setup |
| Security review and hardening | 0.9.4 ✅ | All | The codebase is re-reviewed whenever materially more capable analysis tooling appears. The July 2026 review found nothing permitting private key compromise, data exfiltration or remote code execution; what it did find was fixed in this release |
| Controlled schema migrations (`hortval migrate`) | 0.9.4 ✅ | All | Upgrading never rewrites your schema as a side effect: a restart applies additive changes only, anything riskier waits for an explicit command and your backup |
| Certeasy becomes **Hortval**: the command, the binary and the release artefacts take the new name | 0.9.5 ✅ | All | Nothing inside the ACME protocol carries the name, so no client, account or certificate is affected — what changes is your `ExecStart`, your service `binPath=` and your runbooks |
| Authenticode-signed Windows binary | 0.9.5 ✅ | All | SmartScreen names SAFE PIC TECHNOLOGIES instead of "Unknown publisher" — one less obstacle to getting it approved |
| SQL Server integrated authentication (`authenticator=winsspi`) | 0.9.5 ✅ | Pro / Enterprise | No SQL password in `config.yml`: Hortval connects as the Windows account it runs under |
| Native Windows service (SCM handshake), Windows event log, and a `hortval diag` subcommand to prove where the messages went | 0.9.6 🎯 | All | On the platform Hortval targets, "runs as a service" is what deployment means |
| ADCS lab documentation completed (certificate-template creation in `certtmpl.msc`, SAN and EKU settings, Windows host prerequisites, troubleshooting) | 0.9.7 | All | Customers can deploy without contacting support — CA privileges, EC/RSA templates and `hortval adcs check` are already documented |
| Cleanup / retention of expired ACME records | 1.0 | All | Long-term operations: the database stops growing forever |
| Health / metrics endpoints (`/healthz`, `/readyz`, Prometheus `/metrics`) | 1.0 | All | Drop-in integration with existing supervision (Zabbix, Centreon, Prometheus, Grafana) |
| PKI health checks + load-balanced CAs (Ping at boot + runtime) | 1.0 | All | Mis-configured CAs fail loudly at boot; `round_robin` policy actually skips unhealthy CAs |
| ARI `replaces` semantics (RFC 9773 §5: link, persist, collapse window) | 1.1 | All | Full benefit of ARI in multi-instance fleets |
| Split deployment (Tier 0 connector + ACME responder on separate host) | 2.0 | Enterprise | Keep the ADCS-touching component on Tier 0, expose ACME elsewhere |
| Active/Active high availability (multi-node) | 2.0 | Enterprise | Uptime without a manual failover step |
| External Account Binding (EAB, RFC 8555 §7.3.4) | 2.0 | All | Multi-tenant DevOps deployments (per-team credentials) |
| Distributed validators | 3.0 | Enterprise | Reach internal services that the central node cannot validate (split-DNS, restricted egress) |
| Web dashboard | 4.0 | Pro / Enterprise | Quick operator view without parsing the audit log |
| Monitoring & alerting templates (Grafana, Centreon) | 4.0 | Pro / Enterprise | Alert quick-start without writing your own queries |
| TLS service discovery (probe + deployment status) | 4.0 | Enterprise | End-to-end loop: from "issued" to "actually deployed and serving" |

## Compliance and RFC gaps

The RFC and integration gaps documented in [Standards & RFC support](../reference/standards-compliance.md) are tracked in the table above. ADCS revocation propagation closed in **0.9.3 ✅**; the remaining "1.0" entries close the operational gaps still visible to a standard ACME client today. External Account Binding (EAB) is planned for 2.0.

## Pricing and feature gating

Each feature above is tagged with the plan that includes it and the version it ships in. See the [pricing page](https://hortval.com/#pricing) for the current line-up and the [plans documentation](./plans.md) for what each tier includes.

Subscribe today on an annual plan to **lock the price** and follow the feature ramp without any annual increase.
