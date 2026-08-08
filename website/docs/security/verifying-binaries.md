---
sidebar_position: 3
title: Verifying release binaries
---

# Verifying release binaries

Every Hortval release ships three platform binaries (Linux amd64, macOS arm64, Windows amd64) and a `SHA256SUMS` file:

| File | Purpose |
|---|---|
| `SHA256SUMS` | One SHA-256 hash per binary, one line each. |

`SHA256SUMS` covers **integrity** — it lets you detect a corrupted download or a tampered binary if the `SHA256SUMS` file you used was the one published on the official release page.

## Authenticity — Windows, from v0.9.5

**The Windows binary is signed with Authenticode**, and the signature is
timestamped (RFC 3161). Timestamping is what keeps it valid after the signing
certificate expires: Windows then verifies *"this signature was valid when it
was applied"*, so a binary released today does not become unsigned a year from
now.

Check it before running anything:

```powershell
Get-AuthenticodeSignature .\hortval-vX.Y.Z-windows-amd64.exe | Format-List Status,SignerCertificate
```

`Status` must read `Valid`, and the signer must be **SAFE PIC TECHNOLOGIES**. A
`NotSigned` or `HashMismatch` means the file is not the one that was published —
re-download it.

:::caution Signed does not mean SmartScreen goes away
It still appears. What changes is that the dialog now shows the **publisher's
name** instead of *"Unknown publisher"* — which is the thing you can actually
check. SmartScreen's reputation is built from download volume, not from the
certificate, so a freshly published release warns regardless.

**The prompt is expected. It is not evidence that your download was tampered
with** — the signature check above is. See [Antivirus &
EDR](../administration/antivirus-edr.md#windows-smartscreen--application-control)
for clearing the block, and AppLocker rules.
:::

:::note Linux and macOS: integrity only
Those binaries are not signed, and no GPG-signed `SHA256SUMS.asc` ships. For
them, `SHA256SUMS` is authoritative only insofar as you trust the channel you
fetched it from — the official Releases page over HTTPS.

Distribution through signed package repositories, where the package manager
verifies without anyone having to ask, is the direction being considered rather
than a detached signature nobody downloads.
:::

## Verifying a downloaded release

After downloading the three binaries and `SHA256SUMS` into the same directory:

```bash
sha256sum -c SHA256SUMS
```

Expected output:

```
hortval-vX.Y.Z-linux-amd64: OK
hortval-vX.Y.Z-darwin-arm64: OK
hortval-vX.Y.Z-windows-amd64.exe: OK
```

If any line says `FAILED`, do not run the corresponding binary — re-download it from the official Releases page.

### Windows users without sha256sum

On Windows, use the built-in `certutil`:

```powershell
certutil -hashfile hortval-vX.Y.Z-windows-amd64.exe SHA256
```

Compare the printed SHA-256 against the matching line in `SHA256SUMS`.

## What goes wrong, and what to do

| Output | Meaning | Action |
|---|---|---|
| `sha256sum: WARNING: 1 computed checksum did NOT match` | One of the binaries was modified or truncated. | Re-download the failing binary from the official Releases page. |
| `sha256sum: no properly formatted SHA256 checksum lines found` | You're checking the wrong file, or it was corrupted. | Re-download `SHA256SUMS` itself. |
