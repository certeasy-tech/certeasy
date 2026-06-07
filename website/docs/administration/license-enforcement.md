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

Bringing the server up before a license is installed is an explicit
action. You open a 1-week cold-start window against the plan you intend
to evaluate under:

```
certeasy cold-start init --plan=starter -f config.yml
```

The constraints of the chosen plan (allowed database drivers, maximum
authorities, managed-server cap) apply during the window — exactly as
they would with a real license at that plan level. Once the window is
open, `certeasy serve` boots normally.

When the window is about to elapse and the license has not yet arrived,
extend it for another 7 days:

```
certeasy cold-start extend --confirm -f config.yml
```

Extensions are bounded by a 3-week cumulative cap once your installation
has served any ACME client. See the dedicated
[Cold-start page](cold-start.md) for the full action surface,
including the read-only `cold-start status` diagnostic.

### Degraded — boot refused until acknowledged

If a license is installed and the configuration exceeds it, the server
refuses to start. Two outputs are produced in parallel:

- A **structured JSON log** at `ERROR` level, suitable for journald /
  Grafana / SIEM ingest.
- A **plain-text banner on stderr** so an operator running the binary
  interactively immediately sees what went wrong without having to parse
  JSON. The banner includes the list of failing reasons and the available
  recovery actions.

Example banner:

```
==============================================================================
  CERTEASY — BOOT REFUSED (LICENSE DEGRADED)
==============================================================================

  Installation key: INST-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX
  License key:      CRT-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX

  max_cas_exceeded
  db_not_allowed

  What to do:
    1. Acknowledge and start in degraded mode: certeasy license acknowledge-degraded -f <config>
    2. Or fix your configuration to fit the license (fewer CAs, allowed DB driver, ...)
    3. Or upgrade your plan at https://certeasy.tech/portal/dashboard

==============================================================================
```

The **Installation key** and **License key** lines are present on every
banner so a screenshot of the failed boot is self-sufficient when
contacting support — no need to dig through the logs to find them.

You have three options:

1. **Fix the underlying problem** — reduce the number of authorities,
   change the database driver, or upgrade your plan, then restart.
2. **Acknowledge the degraded state** — run
   `certeasy license acknowledge-degraded`. The server will then start,
   with a clearly visible warning, and continue serving renewals
   (see [Runtime behaviour](#runtime-behaviour) below).
3. **Use force-grace** as a temporary escape hatch
   (see [Force-grace](#force-grace-one-shot-escape-hatch) below).

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

## Installing a license that does not fit the configuration

When you run `certeasy license install`, `certeasy license register`, or
`certeasy license refresh`, the new license is pre-validated against the
running configuration before being written to the database. If the
license's entitlements do not match — for example a plan downgrade that
disallows your current database driver, or grants fewer authorities than
you have declared — the operation is **refused** and the previous state
is preserved untouched.

The CLI prints the mismatch and offers three options:

- Fix the configuration to match the new license, then re-run the
  command.
- Pick a different license that fits.
- Install the license anyway with `--force`. The new license is then
  persisted but the next `certeasy serve` will refuse to start until you
  also run `certeasy license acknowledge-degraded` (see above). This
  path is meant for the case where the plan downgrade is intentional and
  the configuration cleanup is scheduled as a follow-up.

The watcher's online auto-refresh applies the same pre-validation: a
renewed license that does not match the configuration is **not** silently
applied; the previously installed payload remains in effect, an `ERROR`
log line is emitted, and a `license.refresh_rejected` audit event is
recorded (see [Audit events](#audit-events) below). To force-apply a
mismatched refresh, run `certeasy license refresh --force` interactively.

## Force-grace (one-shot escape hatch)

When your installed license has expired beyond the 7-day post-expiry
window and you need immediate breathing room — a renewal is in flight,
the portal had an outage, etc. — you can open a 7-day boot window with:

```
certeasy license force-grace -f config.yml             # preview, nothing is written
certeasy license force-grace -f config.yml --confirm   # actually opens the window
```

Without `--confirm`, the command only **previews** what would happen and
exits without writing anything. The preview shows the anchor, the global
cap, and the window the binary would receive.

Force-grace is intentionally narrow: it is only for a real license that
has expired past its grace. Other situations have their own dedicated
paths and are not covered:

- **No license installed yet** — open a cold-start window with
  `certeasy cold-start init --plan=<plan>` (see [Cold-start](cold-start.md)).
- **License revoked** — revocation is an explicit decision from the
  portal; contact support instead.
- **License signature invalid** — the stored file is corrupted or
  tampered with; this should be investigated, not bypassed.
- **Degraded configuration with a valid license** — use
  `certeasy license acknowledge-degraded` instead. Force-grace is for
  license problems, not configuration problems.

### The 3-week cap

Each force-grace invocation grants up to **7 days**, and may be
re-invoked weekly. The cumulative time the binary can run under
force-grace is capped at **3 weeks** measured from the license expiry
date signed in your `.lic` (tamper-evident: the signature cannot be
rewritten without breaking verification). Once your license has been
expired for more than three weeks, only installing a fresh license
restores normal boot.

### Safety properties

- **Quota enforcement stays active.** Force-grace bypasses the boot
  refusal, not the runtime checks. New orders are still refused if they
  exceed the cap on managed servers or use a disallowed database driver.
  The existing payload constraints (or the cold-start defaults if no
  parseable payload exists) continue to apply.
- **Defense in depth at boot.** The eligibility rules are re-checked on
  every boot, not only at the moment the sub-command is invoked. If the
  persisted force-grace deadline has been altered to exceed the cap, or
  the underlying license problem has been resolved between the activation
  and the boot, the binary ignores the flag.
- **Auto-reset.** Installing a valid license clears the force-grace
  state automatically. The watcher also picks up a mid-window install and
  swaps the in-memory payload without requiring a restart.

### Example session

```
$ certeasy license force-grace -f config.yml --confirm
Force-grace evaluation
  License state : license_expired
  Anchor        : license_expiry
  Anchor at     : 2026-05-26 12:00 UTC
  Global cap    : 2026-06-16 12:00 UTC
  Window grants : until 2026-06-09 18:43 UTC

Force-grace activated until 2026-06-09 18:43 UTC.
You may now start the server normally: certeasy serve -f <config>
```

At boot, a clearly visible banner is printed on stderr:

```
==============================================================================
  CERTEASY — RUNNING IN FORCE-GRACE (7-DAY WINDOW)
==============================================================================

  Installation key: INST-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX
  License key:      CRT-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX

  Underlying license problem: license_expired
  Force-grace expires: 2026-06-09 18:43 UTC
  Force-grace is a ONE-SHOT escape hatch — once consumed, it cannot be re-activated.
  Existing quota constraints still apply to new orders (CAs, managed servers, allowed DBs).
  ...
```

The boot logs also include a `FORCE-GRACE ACTIVE` warning line that gets
picked up by structured-log ingest.

## Boot banner reference

When the server cannot start (or has to start in a degraded mode), the
binary prints a framed banner on stderr in addition to the structured
JSON logs. Every banner carries your **Installation key** and
**License key** so the message is self-sufficient for support. The
table below lists the cases an operator can hit during normal operation
and how to recover from each.

| Banner title | When you see it | How to recover |
|---|---|---|
| `BOOT REFUSED (NO LICENSE, NO COLD-START)` | Fresh installation: no license has been installed and no cold-start window has been opened. | Open a cold-start window with `certeasy cold-start init --plan=<plan>` while you procure a license, or install one directly with `certeasy license register <license-key>` or `certeasy license install <path>`. See [Cold-start](cold-start.md). |
| `BOOT REFUSED (COLD-START WINDOW EXPIRED)` | A cold-start window had been opened but elapsed without a license being installed. | Open a new 7-day window with `certeasy cold-start extend --confirm`, or install your license now with `certeasy license register` / `... install`. The extend command may be refused once the 3-week cumulative cap has been reached — installing a license is then the only path forward. |
| `BOOT REFUSED (COLD-START PLAN MISMATCH)` | A cold-start window is open but the running configuration cannot be honored by the chosen plan (database driver not allowed, or too many authorities declared). | Reduce the configuration to fit the plan (e.g. switch to SQLite, drop an authority), or re-bootstrap with a plan that matches the configuration. |
| `BOOT REFUSED (LICENSE EXPIRED)` | Your installed license has been expired for more than the 7-day post-expiry grace. | Pull the renewed license with `certeasy license refresh`, install the new file manually with `certeasy license install`, register a fresh key with `certeasy license register`, or open a 7-day window with `certeasy license force-grace --confirm`. |
| `BOOT REFUSED (LICENSE DEGRADED)` | A valid license is installed, but the current configuration exceeds what your plan allows (CAs declared, database driver, managed-server count). | Either fix the configuration, upgrade your plan at the portal, or acknowledge the situation with `certeasy license acknowledge-degraded` to start in degraded mode (renewals continue, new orders are refused). |
| `BOOT REFUSED (LICENSE ERROR)` | Catch-all for an unrecognised license problem. | Check the structured log line just above the banner for context; `certeasy license refresh` is a safe first attempt. |
| `RUNNING IN FORCE-GRACE` | Information banner — the server is booting under an open force-grace window. | Resolve the underlying license problem before the window closes (`certeasy license refresh`, `... install`, or `... register` with a renewed key). The window is one-shot per cap period.|

Other banner titles exist for situations that indicate license file
tampering or revocation by the portal. If you encounter one of those,
the recovery is to contact support via the form on the portal.

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
| `license.boot_refused` | The server refused to start. Emitted with one of several reasons: a configuration degraded against a valid license with no acknowledgement, a cold-start window that has elapsed, a cold-start plan mismatch, or "no license and no cold-start window" on a fresh install. | `deny` | `reason`, `reasons` (when degraded), `plan` / `driver` / `configured_cas` (when cold-start) |
| `license.boot_degraded` | The server started in degraded mode against a valid acknowledgement. One event per boot. | `allow` (`reason=ack_active`) | `reasons`, `hash`, `acknowledged_at` |
| `license.acknowledge` | An operator ran `certeasy license acknowledge-degraded`. | `allow` (`reason=operator_ack`) | `reasons`, `hash`, `hostname` |
| `license.install_rejected` | `certeasy license install` or `... register` refused to persist a new license because its entitlements do not match the running configuration. The `--force` flag overrides this refusal. | `deny` (`reason=config_mismatch`) | `source`, `plan`, `driver`, `configured_cas`, `reasons` |
| `license.refresh_rejected` | A refreshed license was rejected because it does not match the running configuration. Emitted both for the manual `certeasy license refresh` path and for the watcher's online auto-refresh path; the `source` field distinguishes them. | `deny` (`reason=config_mismatch`) | `source` (`cli` or `watcher`), `plan`, `driver`, `configured_cas`, `reasons` |
| `license.installation_mismatch` | A stored license is bound to a different installation than this one. The server refuses to use it. | `deny` (`reason=installation_key_mismatch`) | `license_key`, `installation_key` |
| `license.force_grace` | An operator consumed a force-grace window via `certeasy license force-grace --confirm`. | `allow` (`reason=operator_forced`) | `state`, `expires_at`, `cap_at` |
| `license.force_grace_boot` | The server booted under an active force-grace window. One event per boot. | `allow` (`reason=force_grace_active`) | `state`, `expires_at` |
| `license.force_grace_expired` | The active force-grace window elapsed mid-run; the server is stopping. | `deny` (`reason=force_grace_window_elapsed`) | `expired_at` |
| `license.deny` | A new order was refused at runtime because of a license limit. One event per refused request. | `deny` (`reason` = the failing limit) | `reasons` and the offending values (driver, current count, max, etc.) |
| `license.change` | The license state transitioned (`valid` ↔ `grace` ↔ `expired` ↔ `revoked` ↔ `no_license`). | `allow` | `from`, `to` |
| `cold_start.init` | An operator ran `certeasy cold-start init --plan=<plan>` and the window opened. | `allow` (`reason=operator_init`) | `plan`, `expires_at`, `installation_key` |
| `cold_start.init_rejected` | `cold-start init` was refused because the configuration does not match the chosen plan. | `deny` (`reason=config_mismatch`) | `plan`, `driver`, `configured_cas`, `reasons` |
| `cold_start.extend` | An operator opened a new 7-day window via `certeasy cold-start extend --confirm`. | `allow` (`reason=operator_extend`) | `plan`, `anchor`, `cap_at`, `expires_at` |

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
