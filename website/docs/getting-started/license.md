---
sidebar_position: 2
title: License
---

# License

Certeasy requires a valid license file (`.lic`) to run. The Free plan license is issued automatically when you [register](https://certeasy.tech/free). Paid plan licenses are sent by email after your trial or purchase.

## License File Format

The `.lic` file is a PEM-encoded text file:

```
-----BEGIN CERTEASY LICENSE-----
Signature: <base64 Ed25519 signature>

<base64 JSON payload>
-----END CERTEASY LICENSE-----
```

The payload contains your plan, the number of authorized ADCS authorities, and the expiry date. The signature is verified offline against a public key embedded in the binary — no network required at startup.

## Installation

Place the license file in Certeasy's work directory:

| OS | Default path |
|---|---|
| Windows | `%ProgramData%\certeasy\certeasy.lic` |
| Linux | `/var/lib/certeasy/certeasy.lic` |

To use a different path, set it in your configuration file:

```yaml
license: C:\certeasy\certeasy.lic
```

## Validation Behavior

On every startup, Certeasy validates the license **offline** (signature + expiry check). No network call is required for this step.

Certeasy also performs a periodic **online revocation check** against `certeasy.tech`. This check is fail-safe: if the server is unreachable or times out, the binary continues running based on the offline result. Only an explicit revocation response from the server causes a hard failure.

:::note
If your Certeasy host has no internet access, the online check is simply skipped. The binary functions normally as long as the license is not expired.
:::

## Auto-Renewal

Certeasy renews the license file automatically when expiry is within 30 days, by calling `POST /api/license/refresh`. The new `.lic` is written atomically to the same path. If renewal fails (network error, server unavailable), the current license keeps working until its actual expiry date.

No manual action is required for renewal as long as:
- The license file path is writable by the Certeasy service account
- `certeasy.tech` is reachable from the host (or renewal can be done manually — see below)

## Manual Renewal

If auto-renewal is not possible (air-gapped environment, expired license), log in to your [customer portal](https://certeasy.tech/account) to download a fresh `.lic` file, then replace the existing one on the server. A service restart is not required — Certeasy re-reads the license file periodically.

## Checking License Status

```powershell
# Windows — tail the Certeasy log
Get-Content "C:\ProgramData\certeasy\certeasy.log" -Tail 20
```

```bash
# Linux
tail -20 /var/lib/certeasy/certeasy.log
```

On startup, Certeasy logs the active plan, the number of authorized CAs, and the expiry date.

## Troubleshooting

**`license file not found`**  
The `.lic` file is missing or the configured path is wrong. Check the `license` key in your config, or place the file in the default workdir location.

**`invalid license signature`**  
The file is corrupted or was modified. Download a fresh copy from your customer portal.

**`license has expired`**  
Auto-renewal failed. Log in to the [customer portal](https://certeasy.tech/account) to download a new `.lic` and replace it on the server.

**`license has been revoked by the server`**  
The license was revoked (e.g. after a chargeback or duplicate activation). Contact `contact@certeasy.tech`.
