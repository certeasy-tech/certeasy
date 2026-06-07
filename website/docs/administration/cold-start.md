---
sidebar_position: 9
title: Cold-start
---

# Cold-start

When you want to bring Certeasy up before a license is installed — typical
during a fresh install, while a free or paid license is being procured, or
during evaluation — you open a **cold-start window**.

Cold-start is an explicit action: you choose the plan you want to evaluate
under, the binary writes the window into the database, and `certeasy serve`
then boots normally against the plan's limits. The window lasts **1 week**
and is extendable while you finish the onboarding.

Cold-start is the only way to run the server without an installed license.
Past the cold-start window — and once any cumulative cap is reached — only
installing a real license restores normal boot.

## Opening the window

```bash
certeasy cold-start init --plan=<free|starter|pro|enterprise> -f config.yml
```

The chosen plan determines the constraints that apply during the window —
allowed database drivers, maximum number of authorities, managed-server
cap. See [Plans](../intro/plans.md) for the per-plan limits.

Picking a plan that does not match your configuration is refused
immediately: an operator who configures Postgres and asks for `free`
(which only allows SQLite) gets a clear error pointing at the mismatch,
rather than the server booting and refusing every certificate request
later.

`cold-start init` refuses when:

- A license is already installed — uninstall it first if you really want
  to start over, or use one of the regular license commands.
- Cold-start has already been initialised on this installation —
  see "Extending the window" below.
- The running configuration cannot be honored by the chosen plan.

Example:

```
$ certeasy cold-start init --plan=pro -f config.yml
Cold-start initialised.
  Plan       : pro
  Window ends: 2026-06-14 13:23 UTC (168h0m0s remaining)
You may now start the server normally: certeasy serve -f <config>
```

## Inspecting the window

```bash
certeasy cold-start status -f config.yml
```

`cold-start status` is read-only. It prints the current plan, the deadline,
the remaining time, whether a cumulative cap applies (and how much of it
is left), and — when a real license is already installed — a note that
cold-start no longer applies.

Use it whenever you want to confirm what mode the server is in and how
much time is left before the next deadline.

## Extending the window

If the cold-start window is about to elapse and you still need more time —
e.g. the license is on its way but has not arrived yet — open a new
7-day window:

```bash
# Preview only — shows what would change, writes nothing.
certeasy cold-start extend -f config.yml

# Actually opens a new 7-day window.
certeasy cold-start extend --confirm -f config.yml
```

`cold-start extend` is intentionally a separate, deliberate action so that
running the server without a license is always a conscious decision.

### Cumulative cap

Extensions are bounded by a **3-week cumulative cap** measured from the
first time your installation served an ACME client (a tamper-evident
reference — the cap cannot be reset by clearing local state). Until your
installation has served any client, the cap does not apply and extensions
may be re-invoked freely while you finish setup.

Once the cap is reached, the only way forward is to install a real
license. The portal can help with a trial license if a paid plan is in
flight.

`cold-start extend` refuses when:

- A license is already installed — the server is no longer in cold-start.
- Cold-start was never initialised on this installation — run
  `cold-start init` first.
- The cumulative cap has been reached.

## What applies during cold-start

The runtime constraints are the same as for a real license at the same
plan level:

- The allowed database drivers must include the one you configured.
- The number of declared authorities must not exceed the plan's cap.
- New ACME accounts beyond the plan's managed-server cap are refused
  with HTTP 403 and a `license.deny` audit event.

These are checked at boot and on every new order. See the
[License enforcement page](license-enforcement.md) for the full
enforcement surface and the audit events emitted for refused orders.

## Leaving cold-start

Cold-start ends the moment a valid license is installed. Any of the
three license commands clears the cold-start window automatically:

```bash
certeasy license register --env <prod|dev|staging|uat> -f config.yml <license-key>
certeasy license install -f config.yml /path/to/your.lic
certeasy license refresh -f config.yml
```

After installing the license, `certeasy serve` boots against the
license's own constraints. The cold-start state is cleared as part of
the install operation — there is no separate clean-up command.

## Audit events

| Event | When | Decision | Key details |
|---|---|---|---|
| `cold_start.init` | An operator ran `cold-start init --plan=<plan>`. One event per successful initialisation. | `allow` (`reason=operator_init`) | `plan`, `expires_at`, `installation_key` |
| `cold_start.init_rejected` | `cold-start init` was refused because the configuration does not fit the chosen plan. | `deny` (`reason=config_mismatch`) | `plan`, `driver`, `configured_cas`, `reasons` |
| `cold_start.extend` | An operator ran `cold-start extend --confirm`. | `allow` (`reason=operator_extend`) | `plan`, `anchor`, `cap_at`, `expires_at` |

Runtime refusals (`license.deny`, `license.boot_refused`, …) use the same
event names whether the binary is in cold-start or running against a real
license. See [License enforcement / Audit events](license-enforcement.md#audit-events).

The audit log is tamper-evident. Use `certeasy audit verify` to validate
the chain end-to-end (see [Audit log](audit.md)).

## Example session

A fresh install, evaluating against the Pro plan, with a license to come
within the week:

```
$ certeasy cold-start init --plan=pro -f /etc/certeasy/config.yml
Cold-start initialised.
  Plan       : pro
  Window ends: 2026-06-14 13:23 UTC (168h0m0s remaining)
You may now start the server normally: certeasy serve -f <config>

$ certeasy cold-start status -f /etc/certeasy/config.yml
License        : not installed.
Cold-start plan: pro
Window ends    : 2026-06-14 13:23 UTC
Remaining      : 6d23h
Cap            : none (setup phase — no ACME account yet)

# A week later, the license has not arrived yet — open a new window.
$ certeasy cold-start extend --confirm -f /etc/certeasy/config.yml
Cold-start extend evaluation
  Current plan  : pro
  Current window: ends 2026-06-14 13:23 UTC
  Anchor        : first_acme_account
  Anchor at     : 2026-06-10 09:15 UTC
  Global cap    : 2026-07-01 09:15 UTC
  New window    : until 2026-06-21 13:30 UTC

Cold-start window extended until 2026-06-21 13:30 UTC.

# License arrives — register it.
$ certeasy license register --env prod -f /etc/certeasy/config.yml CRT-…
License registered — plan=pro …
```

Once the license is registered, the cold-start window is cleared and
`certeasy serve` runs under the license's own constraints.
