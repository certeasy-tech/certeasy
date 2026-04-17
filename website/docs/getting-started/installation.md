---
sidebar_position: 1
title: Installation
---

# Installation

Certeasy runs as a single binary. It targets **Windows Server** (to run close to your ADCS), but can also run on Linux for test environments.

## Requirements

| Requirement | Detail |
|---|---|
| **OS** | Windows Server 2016+ (production), Linux (dev/test) |
| **ADCS** | Active Directory Certificate Services, accessible from the Certeasy host |
| **certreq.exe** | Available on Windows, used to submit CSRs to ADCS |
| **Network** | Certeasy must be reachable by ACME clients (HTTPS, port 443 or custom) |
| **Database** | SQLite (default, no setup), PostgreSQL, or SQL Server |

## Download

Download the latest release from the [releases page](https://certeasy.tech).

The Windows binary is a single `certeasy.exe` — no installer, no dependencies.

## Directory Layout

Certeasy uses a **work directory** for runtime files (SQLite database, TLS cache, logs). The default locations are:

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

## Running as a Windows Service

The recommended production setup is to run Certeasy as a Windows service using `sc.exe` or NSSM:

```powershell
# Using sc.exe
sc.exe create Certeasy binPath= "C:\certeasy\certeasy.exe -f C:\certeasy\config.yml" start= auto
sc.exe description Certeasy "ACME server for internal ADCS"
sc.exe start Certeasy
```

The service account must have:
- Write access to the work directory
- Access to `certreq.exe` (usually `C:\Windows\System32\certreq.exe`)
- Network access to the ADCS host

## Running on Linux

```bash
go run cmd/main.go -f config.yml
# or
./certeasy -f config.yml
```

:::info
The Linux binary cannot submit to ADCS (no `certreq.exe`). Use the **fake PKI** authority for local testing on Linux.
:::

## Next Step

Once the binary is in place, [configure Certeasy](/getting-started/minimal-configuration).
