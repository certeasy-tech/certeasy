---
sidebar_position: 2
title: License
---

# License

Certeasy requires a valid license file (`.lic`) to run.  
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

## Activation Methods

There are two ways to activate Certeasy: online registration or manual file import.

### Option 1 — Online Registration

Register directly from the command line using your license ID from [certeasy.tech/account](https://certeasy.tech/account).

You need:
- Your **license ID** — available on your account page
- A **deployment environment** label (`prod`, `dev`, `staging`, etc.)

```powershell
# Windows
certeasy.exe -f C:\certeasy\config.yml --register-license <license-id> --env prod
```

```bash
# Linux
./certeasy -f /etc/certeasy/config.yml --register-license <license-id> --env prod
```

The server name defaults to the machine hostname. Override it with `--env-name`:

```bash
./certeasy -f /etc/certeasy/config.yml --register-license <license-id> --env prod --env-name my-server
```

Behavior of `--register-license`:
- connects to certeasy.tech and registers the installation
- downloads and stores the `.lic` in DB automatically
- exits (does not start the ACME server)
- `--env` is required; `--env-name` defaults to the machine hostname

If this installation is already registered under a different license, the command fails with an error asking you to migrate via the portal.

:::note
`--register-license` requires online access to certeasy.tech. For air-gapped environments, use Option 2.
:::

### Option 2 — Manual File Import

Download the `.lic` from [certeasy.tech/account](https://certeasy.tech/account) (you will need the installation ID — see [Runtime Validation](#runtime-validation) below) and import it:

```powershell
# Windows
certeasy.exe -f C:\certeasy\config.yml --license C:\temp\certeasy.lic
```

```bash
# Linux
./certeasy -f /etc/certeasy/config.yml --license /tmp/certeasy.lic
```

Behavior of `--license`:
- validates signature + expiry
- writes the license to DB
- exits (does not start the ACME server)

If the import fails, the process exits with a non-zero code.

## Runtime Validation

At startup, Certeasy validates the stored license offline (signature + expiry).  
No internet access is required for this step.

If no license is installed, Certeasy logs your **installation ID** and the available activation options. To activate:
- run `--register-license` with your license ID from the portal (online), or
- import a `.lic` file with `--license` (offline-compatible)

Startup fails by default without a license. Use `--grace` for a first-install grace window (7 days).

If a license is expired:
- startup is still allowed for 14 days (post-expiry grace)
- after that, startup fails with `license has expired`

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

To manually update a license (air-gapped, support-issued license, etc.), run `--license` again with the new file:

```bash
./certeasy -f /etc/certeasy/config.yml --license /tmp/new-certeasy.lic
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

On startup, Certeasy logs license details (`id`, `plan`, `max_cas`, holder, expiry, source).

## Troubleshooting

**`no license found — download your license at https://certeasy.tech/account`**  
No license is stored in the database. The installation ID is printed in the logs — use it to activate via `--register-license` or download a `.lic` from the portal and import it with `--license`. Use `--grace` for an initial bootstrap grace period.

**`invalid license: invalid license signature`**  
The provided `.lic` file is corrupted or was modified.

**`license has expired`**  
License is beyond the post-expiry startup grace window. Import a renewed license.

**`license has been revoked by the server`**  
The server explicitly revoked the license. Contact `contact@certeasy.tech`.

**`installation already registered under a different license`**  
The installation ID is already bound to a different license on the server. Go to [certeasy.tech/account](https://certeasy.tech/account) to migrate the installation before running `--register-license` again.
