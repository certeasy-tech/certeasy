---
sidebar_position: 4
title: Public roadmap
---

# Public roadmap

This page lists the major features Certeasy ships progressively across versions, what drives each one, and which plan unlocks it. Subscribers on annual plans **lock the price** when they sign up — new features unlock on the same subscription as they ship.

The roadmap is a planning indication, not a contractual commitment. Versions and feature ordering may change based on customer feedback.

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
| Wildcard hardening (multi-level, mixed orders, strict-client audit) | 1.0 🎯 | All | Production-grade wildcard support across all clients |
| RFC 8555 `Location` headers audit complete | 1.0 🎯 | All | Conformance with strict-RFC ACME clients (NativeClient, Caddy) |
| Real ADCS revocation (CRL / OCSP propagation) | 1.0 🎯 | All | A revoked certificate is actually revoked end-to-end |
| Cleanup / retention of expired ACME records | 1.0 🎯 | All | Long-term operations: the database stops growing forever |
| Health / metrics endpoints (`/healthz`, `/readyz`, Prometheus `/metrics`) | 1.0 🎯 | All | Drop-in integration with existing supervision (Zabbix, Centreon, Prometheus, Grafana) |
| PKI health checks + load-balanced CAs (Ping at boot + runtime) | 1.0 🎯 | All | Mis-configured CAs fail loudly at boot; `round_robin` policy actually skips unhealthy CAs |
| ADCS lab documentation (template setup, EKU, SAN, permissions) | 1.0 🎯 | All | Customers can deploy without contacting support |
| ARI `replaces` semantics (RFC 9773 §5: link, persist, collapse window) | 1.1 | All | Full benefit of ARI in multi-instance fleets |
| Split deployment (Tier 0 connector + ACME responder on separate host) | 2.0 | Enterprise | Keep the ADCS-touching component on Tier 0, expose ACME elsewhere |
| Active/Active high availability (multi-node) | 2.0 | Enterprise | Uptime without a manual failover step |
| External Account Binding (EAB, RFC 8555 §7.3.4) | 2.0 | All | Multi-tenant DevOps deployments (per-team credentials) |
| Distributed validators | 3.0 | Enterprise | Reach internal services that the central node cannot validate (split-DNS, restricted egress) |
| Web dashboard | 4.0 | Pro / Enterprise | Quick operator view without parsing the audit log |
| Monitoring & alerting templates (Grafana, Centreon) | 4.0 | Pro / Enterprise | Alert quick-start without writing your own queries |
| TLS service discovery (probe + deployment status) | 4.0 | Enterprise | End-to-end loop: from "issued" to "actually deployed and serving" |

## Compliance and RFC gaps

The RFC gaps documented in [Standards & RFC support](../reference/standards-compliance.md) (wildcard hardening, full `Location` headers audit, ADCS revocation propagation, EAB) are tracked in the table above. The "1.0 🎯" entries close the gaps that are visible to a standard ACME client today.

## Pricing and feature gating

Each feature above is tagged with the plan that includes it and the version it ships in. See the [pricing page](https://certeasy.tech/#pricing) for the current line-up and the [plans documentation](./plans.md) for what each tier includes.

Subscribe today on an annual plan to **lock the price** and follow the feature ramp without any annual increase.
