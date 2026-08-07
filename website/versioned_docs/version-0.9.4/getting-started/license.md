---
sidebar_position: 3
title: License
---

# License

:::tip If you're just getting started
Most operators don't need this page in detail —
[`certeasy init`](wizard.md) walks you through license setup
interactively. This page is for fine-grained control or when you need
to script the activation yourself.
:::

`certeasy serve` will not start without an active license **or** an
explicit cold-start window. You have three ways to get there from a
fresh install — pick the one that matches your situation:

| Situation | Use |
|---|---|
| You have a license key from your account page | [Online registration](#option-1--online-registration) |
| You downloaded a `.lic` file (air-gapped or support-issued) | [Manual file import](#option-2--manual-file-import) |
| You want to evaluate before purchasing / your license is in flight | [Cold-start](#option-3--cold-start-without-a-license-yet) |

Free licenses are issued from [certeasy.tech/free](https://certeasy.tech/free). Paid licenses are sent by email after trial/purchase.

## License File Format

The `.lic` file is a PEM-encoded text file:

```
-----BEGIN CERTEASY LICENSE-----
Signature: <base64 Ed25519 signature>

<base64 JSON payload>
-----END CERTEASY LICENSE-----
```

The payload contains your plan, the number of authorized ADCS authorities, and the expiry date. The signature is verified offline against a public key embedded in the binary.

## Identifiers

Certeasy uses two human-readable keys, both in Crockford-base32 with a built-in check digit (no `I`, `L`, `O`, or `U`):

| Key | Prefix | Example | Where it comes from |
|---|---|---|---|
| **License key** | `CRT-` | `CRT-EAYG2Q-QQBYYQ-VZHZ4M-5GWHNJ-V96MQX` | Issued on your account page; pass to `certeasy license register` |
| **Installation key** | `INST-` | `INST-4RD63B-JE8MKM-MA5R51-DENCSA-52HJ6X` | Generated locally on first start; printed in the logs |

Both keys are five groups of six characters; the last character is a checksum (Luhn mod-32 over Crockford-base32). The example values above intentionally end with `X` and **will not validate** — replace them with the real key shown on your account page or printed in your server logs. A mistyped license key is rejected at `certeasy license register` time with a clear error message before any network call is made.

## Activation Methods

There are three ways to bring Certeasy up: online registration, manual file import, or — when no license has been issued yet — a cold-start window.

### Option 1 — Online Registration

Register directly from the command line using your license key from [certeasy.tech/account](https://certeasy.tech/account).

You need:
- Your **license key** — available on your account page (shape: `CRT-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX`)
- A **deployment environment** label (`prod`, `dev`, `staging`, etc.)

```powershell
# Windows
certeasy.exe license register -f C:\certeasy\config.yml --env prod <license-key>
```

```bash
# Linux
./certeasy license register -f /etc/certeasy/config.yml --env prod <license-key>
```

The server name defaults to the machine hostname. Override it with `--env-name`:

```bash
./certeasy license register -f /etc/certeasy/config.yml --env prod --env-name my-server <license-key>
```

Behavior of `certeasy license register`:
- connects to certeasy.tech and registers the installation
- downloads and stores the `.lic` in DB automatically
- exits (does not start the ACME server)
- `--env` is required; `--env-name` defaults to the machine hostname

If this installation is already registered under a different license, the command fails with an error asking you to migrate via the portal.

:::note
`certeasy license register` requires online access to certeasy.tech. For air-gapped environments, use Option 2.
:::

### Option 2 — Manual File Import

Download the `.lic` from [certeasy.tech/account](https://certeasy.tech/account) (you will need the installation key — see [Runtime Validation](#runtime-validation) below) and import it:

```powershell
# Windows
certeasy.exe license install -f C:\certeasy\config.yml C:\temp\certeasy.lic
```

```bash
# Linux
./certeasy license install -f /etc/certeasy/config.yml /tmp/certeasy.lic
```

Behavior of `certeasy license install`:
- validates signature + expiry
- writes the license to DB
- exits (does not start the ACME server)

If the import fails, the process exits with a non-zero code.

### Option 3 — Cold-start (without a license yet)

Use this when no license has been issued yet — typical during
evaluation, or while a paid license is being procured. Cold-start opens
a **1-week window** during which `certeasy serve` runs against the
constraints of a plan you choose:

```bash
./certeasy cold-start init --plan=pro -f /etc/certeasy/config.yml
```

The plan determines the limits that apply (allowed database drivers,
maximum authorities, managed-server cap) — pick the one that matches
your intended deployment. See [Plans](../intro/plans.md) for the per-plan
limits.

The window can be extended for another 7 days at a time, capped at a
3-week total once your installation has served any ACME client. After
the cap, only installing a real license restores normal boot. See the
[Cold-start page](../administration/cold-start.md) for the full action
surface (`cold-start init`, `cold-start switch`, `cold-start extend`, `cold-start status`)
and the recovery actions if the window elapses.

When the license arrives, install it with any of the methods above —
the cold-start state is cleared automatically.

## Runtime Validation

At startup, Certeasy validates the stored license offline (signature + expiry).  
No internet access is required for this step.

If no license is installed and no cold-start window is open, `certeasy
serve` refuses to start. The startup banner prints your **installation
key** and the three available activation paths listed at the top of this
page.

If a license is expired:
- startup is still allowed for 7 days (post-expiry grace)
- after that, startup fails with `license has expired`

When the binary refuses to start for any license reason, it prints both a
structured JSON log and a plain-text banner on stderr listing the recovery
actions you can take. If your installed license has expired past its
post-expiry grace and you need to keep the binary running while a
renewal is in flight, `certeasy license force-grace --confirm` opens a
7-day window that boots despite the error. See
[License enforcement / Force-grace](../administration/license-enforcement.md#force-grace-one-shot-escape-hatch)
for the full semantics.

## Online Checks and Auto-Renew

Certeasy can optionally run online checks and auto-renew by calling the backend refresh API.

Online behavior is configured in `license` (see [Configuration / License](../configuration/license)).

Default check cadence:
- more than 30 days before expiry: every 30 days
- 30 days or less before expiry: every 24h
- after a failed online attempt: retry in 6h (or 1h near expiry)

If the refresh endpoint is unreachable, Certeasy continues with offline validation.  
Only an explicit server revocation response is a hard failure.

During post-expiry startup grace, online renewal can still recover the installation automatically if online checks are enabled.

By default, online checks are enabled and target Certeasy's official backend.
To force offline mode, set:

```yaml
license:
  offline: true
```

## Manual Renewal / Replacement

To manually update a license (air-gapped, support-issued license, etc.), run `certeasy license install` again with the new file:

```bash
./certeasy license install -f /etc/certeasy/config.yml /tmp/new-certeasy.lic
```

For immediate effect on a running instance, restart the service after import.

## Checking License Status

```powershell
# Windows — tail the Certeasy log
Get-Content "C:\ProgramData\certeasy\certeasy.log" -Tail 20
```

```bash
# Linux
tail -20 /var/lib/certeasy/certeasy.log
```

On startup, Certeasy logs license details (`id`, `plan`, holder, every
enforcement limit — `max_cas`, `max_managed_servers`, `allowed_dbs`,
`active_instances`, `passive_instances` —, expiry, source). Numeric
limits are rendered as `unlimited` (the plan grants no cap),
`<number>` (the cap), or `FORBIDDEN` (the plan grants no entitlement
at all) so missing/zero fields are visible at a glance.

## Troubleshooting

**`WARNING: PRODUCT NOT REGISTERED`**  
No license is stored in the database. The startup logs print your **installation key** (`INST-…`) and the registration URL — use it to activate via `certeasy license register <license-key>` or download a `.lic` from the portal and import it with `certeasy license install`. To start the server before the license is installed, open a cold-start window with `certeasy cold-start init --plan=<plan>` (see [Cold-start](../administration/cold-start.md)).

**`invalid license: invalid license signature`**  
The provided `.lic` file is corrupted or was modified.

**`license has expired`**  
License is beyond the 7-day post-expiry startup grace window. Import a
renewed license, or open a temporary 7-day boot window with
`certeasy license force-grace --confirm` (capped at the license expiry
date + 3 weeks; see
[License enforcement / Force-grace](../administration/license-enforcement.md#force-grace-one-shot-escape-hatch)).

**`license has been revoked by the server`**  
The server explicitly revoked the license. Contact support via the form on the portal.
Force-grace is intentionally not available for revoked licenses.

**`installation already registered under a different license`**  
The installation key is already bound to a different license on the server. Go to [certeasy.tech/account](https://certeasy.tech/account) to migrate the installation before running `certeasy license register` again.

## Next step

Once the license is active (or the cold-start window is open), start
`certeasy serve` and follow the [First certificate](/0.9.4/getting-started/first-certificate)
guide to verify the end-to-end flow with an ACME client.
