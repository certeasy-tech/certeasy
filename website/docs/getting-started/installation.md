---
sidebar_position: 1
title: Installation
---

# Installation

Bringing Certeasy online is a three-step process:

1. **Install the binary** on the host — download, place, create the work directory.
2. **Configure and activate** — the fastest path is [`certeasy init`](wizard.md), an interactive wizard that asks a few questions, writes a valid configuration, and offers to open a cold-start window or install your license on the spot. If you prefer to write the YAML yourself, follow [Minimal configuration](minimal-configuration.md) + [License](license.md).
3. **Deploy as a long-running service** — Windows service or `systemd` unit so the binary survives reboots and restarts.

This page covers steps 1 and 3. Step 2 lives in the dedicated pages further in this section.

## Requirements

| Requirement | Detail |
|---|---|
| **OS** | Windows Server 2016+ (production), Linux (dev/test) |
| **ADCS** | Active Directory Certificate Services, accessible from the Certeasy host |
| **certreq.exe** | Not required by the default native connector. Only needed if you select the `adcs-cli` connector (ships with Windows). |
| **Network** | Certeasy must be reachable by ACME clients (HTTPS, port 443 or custom) |
| **Database** | SQLite (default, no setup), PostgreSQL, or SQL Server |

:::warning Deployment topology
Certeasy is supported as a **single-instance** deployment, or as **cold Active / Passive** with manual switchover (PostgreSQL or SQL Server required, no SQLite). Running two Certeasy instances concurrently against the same database is **not supported** and produces silent failure modes (`badNonce` errors, drifting rate limits, etc.). See [Deployment topology](../administration/deployment-topology.md) before deploying.
:::

## Step 1 — Install the binary

### Download

Download the latest release from the [releases page](https://github.com/certeasy-tech/certeasy/releases).

Each release ships three binaries — `certeasy-<version>-linux-amd64`, `certeasy-<version>-darwin-arm64`, and `certeasy-<version>-windows-amd64.exe`. The Windows binary is a single executable, no installer or runtime dependencies.

:::tip Verify your download
Each release ships a `SHA256SUMS` file. Verify the integrity of the binary before running it — see [Verifying release binaries](../security/verifying-binaries.md).
:::

### Work directory

Certeasy uses a **work directory** for runtime files (SQLite database, TLS cache, logs, identifiers). The default locations are:

- **Windows**: `%ProgramData%\certeasy`
- **Linux**: `/var/lib/certeasy`

Create the directory and make sure Certeasy's service account has write access.

```powershell
# Windows
New-Item -ItemType Directory -Path "C:\ProgramData\certeasy"
```

```bash
# Linux
mkdir -p /var/lib/certeasy
```

At this point the binary is in place but the server is **not** running yet — you need a configuration file and an activated license before `certeasy serve` will accept to start. The next pages walk you through both.

## Step 2 — Configure and activate

The recommended path is:

1. [**Quick start with the wizard**](/getting-started/wizard) — `certeasy init` produces a valid configuration and offers to either open a cold-start window or install / register your license.
2. [**First certificate**](/getting-started/first-certificate) — verify the end-to-end flow with an ACME client.

If you'd rather assemble the YAML by hand, the same content is covered in [Minimal configuration](/getting-started/minimal-configuration) and [License](/getting-started/license).

Once `certeasy serve` runs cleanly and the first ACME client has obtained a certificate, come back to **Step 3** below to productize.

## Step 3 — Deploy as a long-running service

In production you do not want `certeasy serve` running from an interactive shell — it must restart with the host, survive operator sessions, and log to a managed sink. Wrap the binary in a service unit.

### Windows service

The recommended production setup is to run Certeasy as a Windows service using `sc.exe` or [NSSM](https://nssm.cc/):

```powershell
# Using sc.exe
sc.exe create Certeasy binPath= "C:\certeasy\certeasy.exe -f C:\certeasy\config.yml" start= auto
sc.exe description Certeasy "ACME server for internal ADCS"
sc.exe start Certeasy
```

The service account must have:

- Write access to the work directory
- Enroll permission on the ADCS certificate template
- Network access to the ADCS host
- (only with the `adcs-cli` connector) Access to `certreq.exe`, usually `C:\Windows\System32\certreq.exe`

### Linux (systemd)

Create a unit file under `/etc/systemd/system/certeasy.service`:

```ini
[Unit]
Description=Certeasy ACME server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/certeasy -f /etc/certeasy/config.yml
Restart=on-failure
RestartSec=5s
User=certeasy
Group=certeasy
# Hardening — adjust to your environment
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/certeasy
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now certeasy
sudo journalctl -u certeasy -f
```

:::info Linux without ADCS
The Linux binary cannot submit to ADCS — ADCS enrollment is Windows-only (both connectors). For local testing on Linux, use the **fake PKI** authority — see [Configuration / Authorities](../configuration/authorities).
:::

### After deployment

- Logs land in the OS log sink (Event Log on Windows, `journalctl` on systemd). See [Logging](../administration/logging.md) for tuning log format and per-service levels.
- Make sure your monitoring picks up restarts and license-related warnings — see [License enforcement](../administration/license-enforcement.md) for the events emitted at boot and on every refused order.
- Plan for backups of the work directory (database + audit log) — see [Backup and restore](../administration/backup.md).
