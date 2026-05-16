---
sidebar_position: 8
title: Antivirus & EDR
---

# Antivirus &amp; EDR

Certeasy on Windows ADCS spawns `certreq.exe`, writes transient CSR and
certificate files, reads ADCS template metadata, and binds an HTTPS listener.
Endpoint Detection and Response (EDR) products (Microsoft Defender for
Endpoint, CrowdStrike Falcon, SentinelOne, ESET, Sophos, …) and traditional
antivirus tools sometimes interpret this combination as suspicious activity,
because the same primitives appear in credential-theft and lateral-movement
playbooks.

This page lists what Certeasy does on the host, what to allow-list before
deploying, and how to react if the EDR blocks something unexpectedly. The
list below is a best-effort baseline — Certeasy is not certified against
any specific EDR product, and your security team owns the final policy.

## What Certeasy does on the host

| Activity | When | Why an EDR may flag it |
|---|---|---|
| Spawns `certreq.exe -submit`, `-retrieve`, `-config` | Every ACME order finalize, every status poll, every revocation | New parent → `certreq.exe` chains are uncommon outside auto-enrolment, EDRs often score them |
| Writes `*.csr`, `*.cer`, `*.req` to `<workdir>/adcs/` | Transient, deleted within seconds of each issuance | File-creation+deletion bursts of certificate-looking content |
| Reads `HKLM\SYSTEM\CurrentControlSet\Services\CertSvc` keys (indirectly via `certutil`) | Boot and per-request | Registry reads on PKI services trigger some heuristics |
| Binds `0.0.0.0:443` (or configured port) | Boot | A non-IIS process binding `:443` on a Windows server is unusual |
| Writes to the SQLite database file in `<workdir>` | Continuous | Large write rate to an opaque file format |
| Appends to `<workdir>/audit.log` | Every protocol event | Log file growth is usually benign |

## Recommended exclusions

Add the following to your EDR/AV real-time scanning exclusions **before**
starting Certeasy. Replace `C:\Program Files\Certeasy\` and the workdir path
with your actual install path.

### Process exclusions

- `C:\Program Files\Certeasy\certeasy.exe` — the Certeasy binary itself.
- `C:\Windows\System32\certreq.exe` — invoked by Certeasy. Usually already
  trusted by Defender, but third-party EDRs may not whitelist it by default
  in non-standard parent-child relationships.

### Path exclusions

- `<workdir>\` — the entire Certeasy work directory. Subpaths to focus on if
  blanket exclusion is not acceptable:
  - `<workdir>\adcs\` — transient CSR / certificate scratch space (high
    file-creation rate).
  - `<workdir>\db.sqlite`, `<workdir>\db.sqlite-wal`, `<workdir>\db.sqlite-shm`
    — SQLite database files (frequent writes).
  - `<workdir>\audit.log` — append-only audit log.
  - `<workdir>\server-certificate-cache\` — TLS certificate bundles for the
    ACME endpoint.

### Network exclusions

If your EDR has an outbound-connection monitor, allow:
- The ACME listening port (default `:443` or whatever you configured under
  `server.port`).
- Traffic to the ADCS CA host (typically port `135` for RPC + dynamic high
  ports for the actual call — same configuration as a normal `certreq`).
- Traffic to your DNS resolver(s) configured under
  `dns-validation-profiles`.

## Windows SmartScreen / Application Control

If your environment uses Windows SmartScreen or AppLocker:

- The Certeasy binary is currently distributed **unsigned**. SmartScreen will
  prompt the operator on the first launch (`Windows protected your PC`),
  and AppLocker will block it unless an explicit publisher or path rule is
  added.
- Recommended: add a path rule in AppLocker pointing at your install
  directory, or wait for a signed release (planned).
- Defender SmartScreen "warn but allow" can be unblocked by an
  administrator via *Properties → Unblock* on the binary right-click menu.

## If your EDR blocks Certeasy

Symptoms to look for:

- Certeasy exits immediately at startup with `access denied` errors on its
  workdir or on `certreq.exe`.
- ACME orders fail at finalize with a backend error mentioning `certreq` not
  found or terminated; the audit log will show repeated `certificate.issue`
  failures with the same reason.
- A long latency on every order (the EDR is intercepting and analysing each
  `certreq.exe` spawn before letting it run).

To diagnose:

1. Pull the EDR's quarantine / detection log for the host and filter on
   `certeasy.exe` and `certreq.exe`. The detection name and the rule ID
   tell your security team which heuristic fired.
2. Add the [recommended exclusions](#recommended-exclusions) and restart
   Certeasy.
3. If detections continue, capture a Certeasy stderr trace
   (`APP_LOG_LEVEL=debug`) covering one failed order and share it with your
   EDR vendor along with the rule ID — that is enough for them to issue an
   exception or a tuned signature.

## Linux

Linux deployments of Certeasy do not invoke `certreq.exe` — the equivalent
activity is local-only (SQLite + audit log + ACME network traffic). If your
Linux host runs an EDR agent, the recommended exclusions reduce to the
workdir and the listening port; the process exclusion is rarely needed
because Linux EDRs do not generally weight `:443` binders the same way.

## What is NOT a sign of EDR interference

These behaviours are normal and should not be reported to your security
team as a Certeasy issue:

- Brief CPU bursts on the host during a batch of finalize calls — each
  `certreq.exe` spawn does cryptographic work.
- A new `<workdir>\adcs\` file appearing and disappearing within a second
  during issuance — the file is the live CSR, deleted as soon as the ADCS
  response is parsed.
- An audit-log line per protocol event — the audit log is append-only by
  design and meant to grow.
