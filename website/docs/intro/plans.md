---
sidebar_position: 3
title: Plans & Pricing
---

# Plans & Pricing

## Plans

### Free

Ideal for small environments and proof-of-concept deployments.

- **1 production installation**
- **~25 managed servers** (distinct ACME accounts with at least one active certificate)
- **1 ADCS production authority**
- HTTP-01, DNS-01, TLS-ALPN-01 challenge validation
- SQLite database

### Starter — €299 / year *(excl. VAT)*

For small production environments.

- **1 production installation**
- **~250 managed servers** (distinct ACME accounts with at least one active certificate)
- **2 ADCS production authorities**
- HTTP-01, DNS-01, TLS-ALPN-01 challenge validation
- SQLite database

### Pro — €499 / year *(excl. VAT)*

For production environments and larger organizations.

- **1 production installation** (cold Active/Passive supported)
- **Unlimited managed servers**
- **3 ADCS production authorities**
- PostgreSQL database
- SQL Server support
- Dashboard *(coming in v4.0)*
- Monitoring & alerting *(coming in v4.0)*

### Enterprise — €999 / year *(excl. VAT)*

For organizations with advanced requirements.

- Everything in Pro, plus:
- **Up to 5 ADCS production authorities**
- Beyond 5 CAs — [contact us](https://hortval.com/contact)
- Split deployment: ADCS connector on Tier 0 + ACME responder on separate server *(coming in v2.0)*
- Warm Active/Passive and Active/Active high availability (multi-node, requires PostgreSQL or SQL Server) *(coming in v2.0)*
- Distributed validators (segmented networks) *(coming in v3.0)*
- TLS service discovery *(coming in v4.0)*
- Optional SLA

:::tip High availability
Today, Hortval supports **cold Active/Passive** with manual switchover (Pro and above): install it on two hosts sharing a PostgreSQL or SQL Server database, keep the standby fully stopped, and fail over by stopping the active node and starting the standby. Running two instances concurrently against the same database is **not supported** (see [Deployment topology](../administration/deployment-topology.md)). Warm Active/Passive and Active/Active high availability are planned for **v2.0 (Enterprise)**.
:::

:::note License required
A license file (`.lic`) is required to run Hortval, including on the Free plan. Registration takes 30 seconds and delivers the file by email.

**Managed server quota** is counted as the number of distinct ACME accounts with at least one active (non-expired, non-revoked) certificate. Retries and re-issuances from the same ACME account do not count. An account with no active certificate (failed setup, tests) does not consume quota.

Plan quotas (managed server count, number of authorities, allowed database driver) are enforced by the binary at startup and on every new order. Renewals continue to work even when the configuration exceeds the plan, so existing clients are never interrupted by a downgrade. See the [License enforcement page](../administration/license-enforcement.md) for the full behaviour.
:::

## Evaluation period

All paid plans include a **6-month free trial** — sign up, no card required, no automatic charge. At the end, you choose to subscribe for a year or simply stop.

If you subscribe, a new license file is sent to your email. Replace the existing `.lic` file on your server: no reinstallation, no configuration change. Your license is extended by one year from the trial expiry date, not from the payment date.

On connected installations, auto-renewal can be configured so the binary fetches and replaces the file itself. On air-gapped servers, the manual file replacement is the only step required.

[Start your free trial](https://hortval.com/trial) on the official site.

:::note
All prices exclude VAT. One activation slot = one ADCS CA fingerprint. Prices are locked — no unexpected increases.
:::
