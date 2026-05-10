---
sidebar_position: 7
title: License enforcement
---

# License enforcement

Certeasy enforces the limits associated with your active license at two
moments:

- **At boot**, against your configuration and the current state of the
  database (number of declared authorities, database driver in use, number
  of distinct accounts already serving certificates).
- **At runtime**, on every new order, against the live state.

If your configuration exceeds what the active plan allows, the server
refuses to start until you explicitly acknowledge the situation. This is
intentional: a silent downgrade (for example after an automatic license
renewal moves you to a smaller plan) would otherwise only show up later as
ACME clients receiving `403` responses.

## What is checked

| Limit | Source | Boot check | Runtime check (new orders) |
|---|---|---|---|
| Allowed database drivers | Plan | ✅ vs `database.driver` | ✅ |
| Maximum authorities | Plan | ✅ vs number of declared authorities | ✅ |
| Maximum managed servers | Plan | ✅ vs distinct active accounts | ✅ |

A "managed server" is a distinct ACME account with at least one active
(non-expired, non-revoked) certificate. Re-issuances and renewals from the
same account do not consume additional quota.

See the [Plans page](../intro/plans.md) for the per-plan limits.

## Boot behaviour

Three outcomes are possible at startup, depending on whether the
configuration matches the license:

### Conforming — silent boot

Everything is within the plan. The server starts normally and any previous
acknowledgement (see below) is cleared.

### Cold start (no license yet)

If you start with `--grace` and have no license installed yet, Certeasy
applies a temporary cold-start plan (defaulting to **Free**) chosen with
`--cold-start-plan`:

```
certeasy serve --grace --cold-start-plan starter -f config.yml
```

In this mode, the boot only emits warnings — never refuses to start —
because cold start is meant to give you time (96 hours) to install your
license:

```
certeasy license install -f config.yml /path/to/your.lic
```

### Degraded — boot refused until acknowledged

If a license is installed and the configuration exceeds it, the server
refuses to start with a message similar to:

```
LICENSE DEGRADED — server refuses to start.
Reasons: max_cas_exceeded, db_not_allowed.
Run 'certeasy license acknowledge-degraded -f <config>' to acknowledge
and persist this state, or fix your configuration / upgrade your plan.
```

You have two options:

1. **Fix the underlying problem** — reduce the number of authorities,
   change the database driver, or upgrade your plan, then restart.
2. **Acknowledge the degraded state** — run the command shown in the
   message. The server will then start, with a clearly visible warning, and
   continue serving renewals (see [Runtime behaviour](#runtime-behaviour)
   below).

## Acknowledging a degraded state

```
certeasy license acknowledge-degraded -f config.yml
```

This command:

- Reads the active license and the relevant configuration.
- Refuses if the configuration is **not** in a degraded state — there is
  nothing to acknowledge in that case.
- Refuses if no license is installed yet — install your license first, then
  re-run the command.
- Otherwise persists the acknowledgement in the database and prints a
  summary, including the list of reasons and the timestamp.

The acknowledgement is **not** a permanent waiver. It is bound to the
specific combination of plan limits and configuration that triggered it.
The acknowledgement expires automatically when **any** of the following
changes:

- The plan changes (license renewal moves you to a larger or smaller plan).
- The number of declared authorities changes.
- The database driver changes.

A change in the **number of managed servers** alone does **not** invalidate
the acknowledgement. Counts naturally fluctuate with certificate
expirations and revocations; if a previously degraded count drops back
under the cap, the next boot is silent and the acknowledgement is cleared
on its own.

If a future boot is conforming, the stored acknowledgement is removed so
that any new degradation later requires a fresh, explicit acknowledgement.

## Runtime behaviour

Even after a degraded boot has been acknowledged, the server still enforces
the license on every new order:

- **Renewals are always accepted.** A renewal is identified as a new order
  for the same canonical FQDN set already covered by an active certificate
  for that account. This guarantees existing clients keep functioning while
  you fix your configuration.
- **New certificates are refused** with HTTP 403 and an audit log entry
  (`license.deny`) when:
  - The active database driver is not allowed by the plan.
  - The number of declared authorities exceeds `MaxCAs`.
  - The new order would create a managed server beyond `MaxManagedServers`.
  - The plan grants no managed-server entitlement at all.

The audit event includes the reason, the account identifier, the source IP,
and a `details` payload describing the limit that fired. See the
[Audit log page](audit.md) for how to query and verify the audit chain.

## Reasons reference

| Reason | When it fires |
|---|---|
| `db_not_allowed` | The configured `database.driver` is not in the plan's allowed list. |
| `max_cas_exceeded` | More authorities are declared in configuration than the plan allows. |
| `managed_servers_exceeded` | The number of distinct accounts with active certificates is above the plan's cap. |
| `max_managed_servers_zero` | The active license grants no managed-server entitlement at all. |

## Audit events

Every license-enforcement decision is recorded in the [audit log](audit.md)
so that compliance and forensic review can reconstruct what happened
without relying on operator memory or rotated stdout logs. The following
events are emitted:

| Event | When | Decision | Key details |
|---|---|---|---|
| `license.boot_refused` | The server refused to start because the configuration is degraded and no acknowledgement matches. | `deny` | `reasons` |
| `license.boot_degraded` | The server started in degraded mode against a valid acknowledgement. One event per boot. | `allow` (`reason=ack_active`) | `reasons`, `hash`, `acknowledged_at` |
| `license.acknowledge` | An operator ran `certeasy license acknowledge-degraded`. | `allow` (`reason=operator_ack`) | `reasons`, `hash`, `hostname` |
| `license.deny` | A new order was refused at runtime because of a license limit. One event per refused request. | `deny` (`reason` = the failing limit) | `reasons` and the offending values (driver, current count, max, etc.) |
| `license.change` | The license state transitioned (`valid` ↔ `grace` ↔ `expired` ↔ `revoked` ↔ `no_license`). | `allow` | `from`, `to` |

The audit log is tamper-evident (HMAC chain anchored on the installation
identifier). Use `certeasy audit verify` to validate it. See the
[Audit log page](audit.md) for the file format and rotation behaviour.

## Example acknowledgement output

```
$ certeasy license acknowledge-degraded -f config.yml
License degradation acknowledged.
  Reasons: [db_not_allowed max_cas_exceeded]
  Hash:    7a3f...e1b9
  At:      2026-05-10 14:05:22 UTC
The ack will expire automatically if constraints or configuration change.
```

The hash is shown for support and operational diagnostics; you do not need
to record it. Operators typically run this command once after a downgrade,
then schedule the configuration fix or plan upgrade as a follow-up.
