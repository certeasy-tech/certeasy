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

### Starter — €299 / year

For small production environments.

- **1 production installation**
- **~250 managed servers** (distinct ACME accounts with at least one active certificate)
- **2 ADCS production authorities**
- HTTP-01, DNS-01, TLS-ALPN-01 challenge validation
- SQLite database

### Pro — €499 / year

For production environments and larger organizations.

- **1 production installation** (Active/Passive included)
- **Unlimited managed servers**
- **3 ADCS production authorities**
- PostgreSQL database
- SQL Server support *(coming in V2)*
- Dashboard *(coming in V4)*
- Monitoring & alerting *(coming in V4)*

### Enterprise — €999 / year / CA

For organizations with advanced requirements.

- Everything in Pro
- **Up to 5 ADCS production authorities**
- Split deployment: ADCS connector on Tier 0 + ACME responder on separate host *(coming in V2)*
- Active/Active high availability (multi-node, requires PostgreSQL) *(coming in V2)*
- Distributed validation agents (segmented networks) *(coming in V3)*

:::tip Active/Passive high availability
Active/Passive HA is a supported deployment pattern available to all Pro and above users — run two Certeasy instances against the same PostgreSQL database with a load balancer or keepalived in front. No additional license required.
:::
- TLS service discovery *(coming in V4)*
- Optional SLA

Beyond 5 CAs — [contact us](https://certeasy.tech/contact).

:::note License required — limits not yet enforced
A license file (`certeasy.lic`) is required to run Certeasy, including on the Free plan. Registration takes 30 seconds and delivers the file by email.

**Managed server quota** is counted as the number of distinct ACME accounts with at least one active (non-expired, non-revoked) certificate. Retries and re-issuances from the same ACME account do not count. An account with no active certificate (failed setup, tests) does not consume quota.

Plan quotas (managed server count, number of ADCS authorities) are not yet enforced: all active licenses currently have full access regardless of plan. Enforcement will be introduced before the V1 stable release.
:::

## Evaluation period

All paid plans include a **6-month free trial** — sign up, no card required, no automatic charge. At the end, you choose to subscribe for a year or simply stop.

If you subscribe, your license is extended by one year from the trial expiry date — not from the payment date. No re-activation, no service interruption.

[Start your free trial](https://certeasy.tech/trial) on the official site.

:::note
All prices exclude VAT. One activation slot = one ADCS CA fingerprint. Prices are locked — no unexpected increases.
:::
