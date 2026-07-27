---
sidebar_position: 3
title: Verifying release binaries
---

# Verifying release binaries

Every Certeasy release ships three platform binaries (Linux amd64, macOS arm64, Windows amd64) and a `SHA256SUMS` file:

| File | Purpose |
|---|---|
| `SHA256SUMS` | One SHA-256 hash per binary, one line each. |

`SHA256SUMS` covers **integrity** — it lets you detect a corrupted download or a tampered binary if the `SHA256SUMS` file you used was the one published on the official release page.

:::warning Authenticity is not yet covered
v0.9.x releases do **not** ship a GPG-signed `SHA256SUMS.asc`, and the Windows binary is **not** signed with Authenticode. A GPG signature on `SHA256SUMS` is planned for a later release (see the [roadmap](../intro/roadmap.md)). Until then, treat the published `SHA256SUMS` as authoritative only insofar as you trust the channel you fetched it from (the official GitHub Releases page over HTTPS).
:::

On Windows you will see this at first launch: with no Authenticode signature, SmartScreen displays *"Windows protected your PC"*, and AppLocker blocks the binary outright unless a rule allows it. **That prompt is expected — it is not a sign that your download was tampered with.** Verify the hash below to confirm, then see [Antivirus & EDR](../administration/antivirus-edr.md#windows-smartscreen--application-control) for how to clear the block.

## Verifying a downloaded release

After downloading the three binaries and `SHA256SUMS` into the same directory:

```bash
sha256sum -c SHA256SUMS
```

Expected output:

```
certeasy-vX.Y.Z-linux-amd64: OK
certeasy-vX.Y.Z-darwin-arm64: OK
certeasy-vX.Y.Z-windows-amd64.exe: OK
```

If any line says `FAILED`, do not run the corresponding binary — re-download it from the official Releases page.

### Windows users without sha256sum

On Windows, use the built-in `certutil`:

```powershell
certutil -hashfile certeasy-vX.Y.Z-windows-amd64.exe SHA256
```

Compare the printed SHA-256 against the matching line in `SHA256SUMS`.

## What goes wrong, and what to do

| Output | Meaning | Action |
|---|---|---|
| `sha256sum: WARNING: 1 computed checksum did NOT match` | One of the binaries was modified or truncated. | Re-download the failing binary from the official Releases page. |
| `sha256sum: no properly formatted SHA256 checksum lines found` | You're checking the wrong file, or it was corrupted. | Re-download `SHA256SUMS` itself. |
