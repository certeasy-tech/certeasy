---
sidebar_position: 1
title: Installation
---

# Installation

Bringing Hortval online is a three-step process:

1. **Install the binary** on the host — download, place, create the work directory.
2. **Configure and activate** — the fastest path is [`hortval init`](wizard.md), an interactive wizard that asks a few questions, writes a valid configuration, and offers to open a cold-start window or install your license on the spot. If you prefer to write the YAML yourself, follow [Minimal configuration](minimal-configuration.md) + [License](license.md).
3. **Deploy as a long-running service** — Windows service or `systemd` unit so the binary survives reboots and restarts.

This page covers steps 1 and 3. Step 2 lives in the dedicated pages further in this section.

## Requirements

| Requirement | Detail |
|---|---|
| **OS** | Windows Server 2016+ (production), Linux (dev/test) |
| **ADCS** | Active Directory Certificate Services, accessible from the Hortval host |
| **certreq.exe** | Not required by the default native connector. Only needed if you select the `adcs-cli` connector (ships with Windows). |
| **Network** | Hortval must be reachable by ACME clients (HTTPS, port 443 or custom) |
| **Database** | SQLite (default, no setup), PostgreSQL, or SQL Server |

:::warning Deployment topology
Hortval is supported as a **single-instance** deployment, or as **cold Active / Passive** with manual switchover (PostgreSQL or SQL Server required, no SQLite). Running two Hortval instances concurrently against the same database is **not supported** and produces silent failure modes (`badNonce` errors, drifting rate limits, etc.). See [Deployment topology](../administration/deployment-topology.md) before deploying.
:::

## Step 1 — Install the binary

### Download

Download the latest release from the [releases page](https://github.com/hortval/hortval/releases).

Each release ships three binaries — `hortval-<version>-linux-amd64`, `hortval-<version>-darwin-arm64`, and `hortval-<version>-windows-amd64.exe`. The Windows binary is a single executable, no installer or runtime dependencies.

:::tip Verify your download
Each release ships a `SHA256SUMS` file. Verify the integrity of the binary before running it — see [Verifying release binaries](../security/verifying-binaries.md).
:::

### Work directory

Hortval uses a **work directory** for runtime files (SQLite database, TLS cache, logs, identifiers). The default locations are:

- **Windows**: `%ProgramData%\hortval`
- **Linux**: `/var/lib/hortval`

Create the directory and make sure Hortval's service account has write access.

```powershell
# Windows
New-Item -ItemType Directory -Path "C:\ProgramData\hortval"
```

```bash
# Linux
mkdir -p /var/lib/hortval
```

At this point the binary is in place but the server is **not** running yet — you need a configuration file and an activated license before `hortval serve` will accept to start. The next pages walk you through both.

## Step 2 — Configure and activate

The recommended path is:

1. [**Quick start with the wizard**](./wizard.md) — `hortval init` produces a valid configuration and offers to either open a cold-start window or install / register your license.
2. [**First certificate**](./first-certificate.md) — verify the end-to-end flow with an ACME client.

If you'd rather assemble the YAML by hand, the same content is covered in [Minimal configuration](./minimal-configuration.md) and [License](./license.md).

Once `hortval serve` runs cleanly and the first ACME client has obtained a certificate, come back to **Step 3** below to productize.

## Step 3 — Deploy as a long-running service

In production you do not want `hortval serve` running from an interactive shell — it must restart with the host, survive operator sessions, and log to a managed sink. Wrap the binary in a service unit.

### Windows service

Run Hortval as a Windows service using `sc.exe` or [NSSM](https://nssm.cc/),
under a **dedicated service account**.

:::danger Hortval does not run as a Windows service yet — this ships in v0.9.6
**v0.9.5 cannot be started by the Service Control Manager.** Hortval does not
implement the SCM handshake, so a service created with `sc.exe` fails to start
with **error 1053** — "the service did not respond to the start request in a
timely fashion". The process does run for about thirty seconds before the SCM
kills it, which leaves the shutdown drain unfinished and `db.sqlite-wal` /
`db.sqlite-shm` files behind.

This is a known limitation of the first release, not a configuration mistake:
nothing you change in `config.yml` or in the `sc.exe` line will fix it. Native
service support — SCM handshake, Windows event log, and a `hortval diag`
subcommand to prove where the logs went — is the headline of **v0.9.6**.

**Until then**, run `hortval serve -f <config>` in a console, or under a wrapper
that performs the SCM handshake on the binary's behalf — a scheduled task, or
NSSM. Neither wrapper has been validated against Hortval yet.

Whichever you choose, **capture stderr**. A handful of startup lines are written
there and never reach `logs.file`, and when startup is *refused* the log file is
not created at all — everything goes to stderr. Under the Windows SCM stderr is
attached to nothing, so those lines are lost outright. Under NSSM, set
`AppStderr`.

The procedure below is the target shape and is correct for the account model —
only the start step is affected.
:::

:::caution Do not run the service as LocalSystem
`sc.exe create` without `obj=` gives you LocalSystem, the highest local
privilege. Hortval listens on the network and holds the enrollment identity for
your CA, so that account is the wrong place for it. Give it an account whose only
privilege on the PKI is the one it needs.
:::

Enroll permission is granted in Active Directory, so the account has to be a
domain account. A **group Managed Service Account (gMSA)** is the best option:
Windows rotates its password and it is never typed anywhere.

```powershell
# Once, on a domain controller
New-ADServiceAccount -Name hortval -DNSHostName hortval.example.com `
  -PrincipalsAllowedToRetrieveManagedPassword "HORTVAL-HOST$"

# On the Hortval host
Install-ADServiceAccount -Identity hortval
```

Create the service under it — the trailing `$` and the empty password are how a
gMSA is declared:

```powershell
sc.exe create Hortval `
  binPath= "C:\hortval\hortval.exe -f C:\hortval\config.yml" `
  obj= "EXAMPLE\hortval$" password= "" start= auto
sc.exe description Hortval "ACME server for internal ADCS"
sc.exe start Hortval
```

Where gMSA is not available, use an ordinary domain account dedicated to
Hortval — `obj= "EXAMPLE\svc-hortval" password= "..."` — with its password
held in your secret store.

Grant that account, and nothing beyond:

- **Log on as a service** (`SeServiceLogonRight`) — the service will not start without it
- Write access to the work directory
- Enroll permission on the ADCS certificate template
- Network access to the ADCS host
- (only with the `adcs-cli` connector) Read and execute on `certreq.exe` and `certutil.exe` in the Windows system directory

Reusing an existing administrative account defeats the point: enrollment on one
template is the only right Hortval needs on your PKI, and whatever else the
account carries is available to anything that reaches the service.

### Linux (systemd)

Create a unit file under `/etc/systemd/system/hortval.service`:

```ini
[Unit]
Description=Hortval ACME server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/hortval -f /etc/hortval/config.yml
Restart=on-failure
RestartSec=5s
User=hortval
Group=hortval
# Hardening — adjust to your environment
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/var/lib/hortval
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hortval
sudo journalctl -u hortval -f
```

:::info Linux without ADCS
The Linux binary cannot submit to ADCS — ADCS enrollment is Windows-only (both connectors). For local testing on Linux, use the **fake PKI** authority — see [Configuration / Authorities](../configuration/authorities).
:::

### After deployment

- Logs land in the OS log sink (Event Log on Windows, `journalctl` on systemd). See [Logging](../administration/logging.md) for tuning log format and per-service levels.
- Make sure your monitoring picks up restarts and license-related warnings — see [License enforcement](../administration/license-enforcement.md) for the events emitted at boot and on every refused order.
- Plan for backups of the work directory (database + audit log) — see [Backup and restore](../administration/backup.md).
