---
sidebar_position: 3
title: License
---

# License

:::tip If you're just getting started
Most operators don't need this page in detail —
[`hortval init`](wizard.md) walks you through license setup
interactively. This page is for fine-grained control or when you need
to script the activation yourself.
:::

`hortval serve` will not start without an active license **or** an
explicit cold-start window. You have three ways to get there from a
fresh install — pick the one that matches your situation:

| Situation | Use |
|---|---|
| You have a license key from your account page | [Online registration](#option-1--online-registration) |
| You downloaded a `.lic` file (air-gapped or support-issued) | [Manual file import](#option-2--manual-file-import) |
| You want to evaluate before purchasing / your license is in flight | [Cold-start](#option-3--cold-start-without-a-license-yet) |

Free licenses are issued from [hortval.com/free](https://hortval.com/free). Paid licenses are sent by email after trial/purchase.

## License File Format

The `.lic` file is a PEM-encoded text file:

```
-----BEGIN HORTVAL LICENSE-----
Signature: <base64 Ed25519 signature>

<base64 JSON payload>
-----END HORTVAL LICENSE-----
```

The payload contains your plan, the number of authorized ADCS authorities, and the expiry date. The signature is verified offline against a public key embedded in the binary.

:::note You may also receive a `CERTEASY LICENSE` block
Licences issued before the rename carry `-----BEGIN CERTEASY LICENSE-----`, and the portal still serves that form by default. **Hortval reads both**, so either file works and there is nothing to convert. Only the older Certeasy binaries are restricted to the legacy block — which is why it remains the default.
:::

## Identifiers

Hortval uses two human-readable keys, both in Crockford-base32 with a built-in check digit (no `I`, `L`, `O`, or `U`):

| Key | Prefix | Example | Where it comes from |
|---|---|---|---|
| **License key** | `CRT-` | `CRT-EAYG2Q-QQBYYQ-VZHZ4M-5GWHNJ-V96MQX` | Issued on your account page; pass to `hortval license register` |
| **Installation key** | `INST-` | `INST-4RD63B-JE8MKM-MA5R51-DENCSA-52HJ6X` | Generated locally on first start; printed in the logs |

Both keys are five groups of six characters; the last character is a checksum (Luhn mod-32 over Crockford-base32). The example values above intentionally end with `X` and **will not validate** — replace them with the real key shown on your account page or printed in your server logs. A mistyped license key is rejected at `hortval license register` time with a clear error message before any network call is made.

## Activation Methods

There are three ways to bring Hortval up: online registration, manual file import, or — when no license has been issued yet — a cold-start window.

### Option 1 — Online Registration

Register directly from the command line using your license key from [hortval.com/account](https://hortval.com/account).

You need:
- Your **license key** — available on your account page (shape: `CRT-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX`)
- A **deployment environment** label (`prod`, `dev`, `staging`, etc.)

```powershell
# Windows
hortval.exe license register -f C:\hortval\config.yml --env prod <license-key>
```

```bash
# Linux
./hortval license register -f /etc/hortval/config.yml --env prod <license-key>
```

The server name defaults to the machine hostname. Override it with `--env-name`:

```bash
./hortval license register -f /etc/hortval/config.yml --env prod --env-name my-server <license-key>
```

Behavior of `hortval license register`:
- connects to hortval.com and registers the installation
- downloads and stores the `.lic` in DB automatically
- exits (does not start the ACME server)
- `--env` is required; `--env-name` defaults to the machine hostname

If this installation is already registered under a different license, the command fails with an error asking you to migrate via the portal.

:::note
`hortval license register` requires online access to hortval.com. For air-gapped environments, use Option 2.
:::

### Option 2 — Manual File Import

Download the `.lic` from [hortval.com/account](https://hortval.com/account) (you will need the installation key — see [Runtime Validation](#runtime-validation) below) and import it:

```powershell
# Windows
hortval.exe license install -f C:\hortval\config.yml C:\temp\hortval.lic
```

```bash
# Linux
./hortval license install -f /etc/hortval/config.yml /tmp/hortval.lic
```

Behavior of `hortval license install`:
- validates signature + expiry
- writes the license to DB
- exits (does not start the ACME server)

If the import fails, the process exits with a non-zero code.

### Option 3 — Cold-start (without a license yet)

Use this when no license has been issued yet — typical during
evaluation, or while a paid license is being procured. Cold-start opens
a **1-week window** during which `hortval serve` runs against the
constraints of a plan you choose:

```bash
./hortval cold-start init --plan=pro -f /etc/hortval/config.yml
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

At startup, Hortval validates the stored license offline (signature + expiry).  
No internet access is required for this step.

If no license is installed and no cold-start window is open, `hortval
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
renewal is in flight, `hortval license force-grace --confirm` opens a
7-day window that boots despite the error. See
[License enforcement / Force-grace](../administration/license-enforcement.md#force-grace-one-shot-escape-hatch)
for the full semantics.

## Online Checks and Auto-Renew

Hortval can optionally run online checks and auto-renew by calling the backend refresh API.

Online behavior is configured in `license` (see [Configuration / License](../configuration/license)).

Default check cadence:
- more than 30 days before expiry: every 30 days
- 30 days or less before expiry: every 24h
- after a failed online attempt: retry in 6h (or 1h near expiry)

If the refresh endpoint is unreachable, Hortval continues with offline validation.  
Only an explicit server revocation response is a hard failure.

During post-expiry startup grace, online renewal can still recover the installation automatically if online checks are enabled.

By default, online checks are enabled and target Hortval's official backend.
To force offline mode, set:

```yaml
license:
  offline: true
```

## Manual Renewal / Replacement

To manually update a license (air-gapped, support-issued license, etc.), run `hortval license install` again with the new file:

```bash
./hortval license install -f /etc/hortval/config.yml /tmp/new-hortval.lic
```

For immediate effect on a running instance, restart the service after import.

## Checking License Status

```powershell
# Windows — tail the Hortval log
Get-Content "C:\ProgramData\hortval\hortval.log" -Tail 20
```

```bash
# Linux
tail -20 /var/lib/hortval/hortval.log
```

On startup, Hortval logs license details (`id`, `plan`, holder, every
enforcement limit — `max_cas`, `max_managed_servers`, `allowed_dbs`,
`active_instances`, `passive_instances` —, expiry, source). Numeric
limits are rendered as `unlimited` (the plan grants no cap),
`<number>` (the cap), or `FORBIDDEN` (the plan grants no entitlement
at all) so missing/zero fields are visible at a glance.

## Troubleshooting

**`WARNING: PRODUCT NOT REGISTERED`**  
No license is stored in the database. The startup logs print your **installation key** (`INST-…`) and the registration URL — use it to activate via `hortval license register <license-key>` or download a `.lic` from the portal and import it with `hortval license install`. To start the server before the license is installed, open a cold-start window with `hortval cold-start init --plan=<plan>` (see [Cold-start](../administration/cold-start.md)).

**`invalid license: invalid license signature`**  
The provided `.lic` file is corrupted or was modified.

**`license has expired`**  
License is beyond the 7-day post-expiry startup grace window. Import a
renewed license, or open a temporary 7-day boot window with
`hortval license force-grace --confirm` (capped at the license expiry
date + 3 weeks; see
[License enforcement / Force-grace](../administration/license-enforcement.md#force-grace-one-shot-escape-hatch)).

**`license has been revoked by the server`**  
The server explicitly revoked the license. Contact support via the form on the portal.
Force-grace is intentionally not available for revoked licenses.

**`installation already registered under a different license`**  
The installation key is already bound to a different license on the server. Go to [hortval.com/account](https://hortval.com/account) to migrate the installation before running `hortval license register` again.

## Next step

Once the license is active (or the cold-start window is open), start
`hortval serve` and follow the [First certificate](./first-certificate.md)
guide to verify the end-to-end flow with an ACME client.
