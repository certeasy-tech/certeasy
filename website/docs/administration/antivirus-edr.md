---
sidebar_position: 8
title: Antivirus & EDR
---

# Antivirus &amp; EDR

:::tip Native connector (default): no `certreq.exe` spawn
Since **v0.9.2** the default ADCS connector (`type: adcs` / `adcs-native`)
enrolls **in-process** — Hortval launches no child process. The LOLBin
parent-child signature that strict EDRs used to flag (the same pattern as
offensive ADCS tooling such as Certify / Certipy) is simply not produced. For a
default deployment, the certreq-specific guidance on this page **does not
apply** — the remaining host activity (an HTTPS listener, a local database, an
append-only log) is benign.

The certreq.exe details below apply **only if you explicitly chose the
`adcs-cli` connector** (see [Authorities](../configuration/authorities.md)).
:::

With the **native connector (default)**, Hortval on a Windows ADCS host binds
an HTTPS listener, writes to a local database, and appends to an audit log — no
child process, no transient certificate files on disk.

With the **`adcs-cli` connector**, Hortval additionally spawns `certreq.exe`
and writes transient CSR / certificate files for each issuance. Endpoint
Detection and Response (EDR) products (Microsoft Defender for Endpoint,
CrowdStrike Falcon, SentinelOne, ESET, Sophos, …) sometimes flag that
parent-child chain, because the same primitives appear in offensive playbooks.

This page lists what Hortval does on the host, what to allow-list before
deploying, and how to react if the EDR blocks something unexpectedly. It is a
best-effort baseline — Hortval is not certified against any specific EDR
product, and your security team owns the final policy.

## What Hortval does on the host

| Activity | When | Connector | Why an EDR may flag it |
|---|---|---|---|
| Binds `0.0.0.0:443` (or configured port) | Boot | both | A non-IIS process binding `:443` on a Windows server is unusual |
| Writes to the SQLite database file in `<workdir>` | Continuous | both | Large write rate to an opaque file format |
| Appends to `<workdir>/audit.log` | Every protocol event | both | Log file growth is usually benign |
| Enrolls in-process via the Windows certificate API | Every order finalize / status poll | native (default) | No child process; indistinguishable from a normal enrollment client |
| Spawns `certreq.exe -submit`, `-retrieve`, `-config` | Every order finalize, every status poll | `adcs-cli` only | New parent → `certreq.exe` chains are uncommon outside auto-enrolment, EDRs often score them |
| Writes `*.csr`, `*.cer`, `*.req` to `<workdir>/adcs/` | Transient, deleted within seconds of each issuance | `adcs-cli` only | File-creation+deletion bursts of certificate-looking content |

## Recommended exclusions

Add the following to your EDR/AV real-time scanning exclusions **before**
starting Hortval. Replace `C:\Program Files\Hortval\` and the workdir path
with your actual install path.

### Process exclusions

- `C:\Program Files\Hortval\hortval.exe` — the Hortval binary itself.
- `C:\Windows\System32\certreq.exe` — **`adcs-cli` connector only.** Invoked by
  Hortval in that mode. Usually already trusted by Defender, but third-party
  EDRs may not whitelist it by default in non-standard parent-child
  relationships. The default native connector launches no child process, so this
  exclusion is unnecessary there.

### Path exclusions

- `<workdir>\` — the entire Hortval work directory. Subpaths to focus on if
  blanket exclusion is not acceptable:
  - `<workdir>\adcs\` — **`adcs-cli` connector only:** transient CSR /
    certificate scratch space (high file-creation rate). The native connector
    writes no such files.
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
  ports for the actual call — the same RPC/DCOM ports any Windows enrollment
  client uses, whether native or `certreq`).
- Traffic to your DNS resolver(s) configured under
  `dns-validation-profiles`.

## Windows SmartScreen / Application Control

**From v0.9.5 the Windows binary is signed** (Authenticode, timestamped). See
[Verifying release binaries](../security/verifying-binaries.md) for the check
and the publisher name to expect.

### When SmartScreen actually prompts

Not "when a binary is unsigned" — that is the common misreading. The app
dialog is raised by the **Mark of the Web**: an NTFS alternate data stream a
browser or mail client attaches to what it saves. **No mark, no prompt**,
signed or not.

That distinction decides what your operators will see:

| How the binary reached the machine | Marked? | Prompt |
|---|---|---|
| Downloaded with a browser | yes | possible |
| `curl.exe`, `Invoke-WebRequest` | no | no |
| Copied from an internal share, or a USB stick | no | no |
| Deployed by your software distribution tool | no | no |

So an administrator who fetches Hortval from a terminal, or deploys it from an
internal repository — which is how it usually arrives on a server — will not
meet SmartScreen at all.

**Which is a reason to verify the signature, not a reason to skip it.** Those
are the paths on which nothing is checked and nothing is displayed, and this
binary ends up on a host that enrols certificates against your CA. See
[Verifying release binaries](../security/verifying-binaries.md).

An administrator can also clear the mark deliberately: *Properties → Unblock*
on the file, or `Unblock-File` in PowerShell.

### What signing changes, and what it does not

It does **not** remove the prompt. SmartScreen weighs two things: the file's
own download history, and the publisher's reputation. An unsigned binary
accrues reputation per exact file, so every release starts from zero. A signed
one accrues it on the **publisher identity**, so releases build on each other.

What changes immediately is the name: the dialog reads the publisher instead of
*"Unknown publisher"* — which is the part you can verify. A recently published
release may still warn while that reputation is young.

Note that the name is **not on the first screen**. That one offers a single
`Don't run` button; the publisher appears only after clicking **More info** —
and on a server carrying the Microsoft security baseline (*"Warn and prevent
bypass"*), there is no override button at all. Clear the Mark of the Web with
`Unblock-File`, or allow the binary with an AppLocker publisher rule. The exact
sequence is in
[Verifying release binaries](../security/verifying-binaries.md#the-publisher-name-is-behind-a-click).

### AppLocker / WDAC

A signed binary lets you write a **publisher rule** rather than a path rule,
which survives a move or a rename and does not have to be widened to a
directory. A path rule pointing at your install directory remains valid, and is
the simpler option if your policy already works that way.

## If your EDR blocks Hortval

Symptoms to look for:

- Hortval exits immediately at startup with `access denied` errors on its
  workdir (or, with `adcs-cli`, on `certreq.exe`).
- ACME orders fail at finalize with a backend error; the audit log shows
  repeated `certificate.issue` failures with the same reason. With `adcs-cli`
  the error typically mentions `certreq` not found or terminated.
- (`adcs-cli` only) A long latency on every order, because the EDR intercepts
  and analyses each `certreq.exe` spawn before letting it run.

To diagnose:

1. Pull the EDR's quarantine / detection log for the host and filter on
   `hortval.exe` and `certreq.exe`. The detection name and the rule ID
   tell your security team which heuristic fired.
2. Add the [recommended exclusions](#recommended-exclusions) and restart
   Hortval.
3. If detections continue, capture a Hortval stderr trace
   (`APP_LOG_LEVEL=debug`) covering one failed order and share it with your
   EDR vendor along with the rule ID — that is enough for them to issue an
   exception or a tuned signature.

## Linux

Linux deployments of Hortval do not invoke `certreq.exe` — the equivalent
activity is local-only (SQLite + audit log + ACME network traffic). If your
Linux host runs an EDR agent, the recommended exclusions reduce to the
workdir and the listening port; the process exclusion is rarely needed
because Linux EDRs do not generally weight `:443` binders the same way.

## What is NOT a sign of EDR interference

These behaviours are normal and should not be reported to your security
team as a Hortval issue:

- Brief CPU bursts on the host during a batch of finalize calls — enrollment
  does cryptographic work (and, with `adcs-cli`, each `certreq.exe` spawn).
- (`adcs-cli` only) A new `<workdir>\adcs\` file appearing and disappearing
  within a second during issuance — the file is the live CSR, deleted as soon
  as the ADCS response is parsed.
- An audit-log line per protocol event — the audit log is append-only by
  design and meant to grow.
