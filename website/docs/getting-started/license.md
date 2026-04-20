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

## Install / Update a License

Certeasy does not read `certeasy.lic` directly at runtime.  
You install (or replace) a license by importing the `.lic` into the application database:

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

If no license is installed:
- startup fails by default
- `--grace` allows a first-install grace window (96h)

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
No license is stored in the database. Import one with `--license`, or use `--grace` for initial bootstrap.

**`invalid license: invalid license signature`**  
The provided `.lic` file is corrupted or was modified.

**`license has expired`**  
License is beyond the post-expiry startup grace window. Import a renewed license.

**`license has been revoked by the server`**  
The server explicitly revoked the license. Contact `contact@certeasy.tech`.
