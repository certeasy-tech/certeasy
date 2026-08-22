---
sidebar_position: 1
title: FAQ
---

# Frequently asked questions

## My PKI / ADCS template only allows RSA — how do I configure Hortval? {#rsa-only-templates}

RSA-only templates (for example a Microsoft ADCS template with a minimum key
size of 4096 and an RSA provider) reject ECDSA keys. Two different keys are
involved, and both must be RSA.

**1. Hortval's own server certificate.** Hortval generates this key and
defaults to ECDSA P-256. Pin it to RSA on the certificate-manager bundle:

```yaml
tls-certificate-manager:
  bundles:
    - name: server
      mode: pki
      authority: ca1
      key:
        type: rsa
        size: 4096
```

See [TLS certificate manager → Key type](../configuration/tls.md#key-type).

**2. Certificates issued to ACME clients.** Here the *client* generates the key,
so the key type is chosen on the client, not in Hortval. Most clients default to
ECDSA (or RSA 2048), which an RSA-4096 template rejects — set it explicitly:

| Client | Option |
|---|---|
| lego | `--key-type rsa4096` |
| certbot | `--key-type rsa --rsa-key-size 4096` |
| acme.sh | `--keylength 4096` |

**3. (Recommended) Reject a wrong key early.** Constrain the issuance policy to
match the template, so a non-conforming client request is refused by Hortval
with a clear message rather than forwarded and denied opaquely by the CA:

```yaml
issuance-policies:
  - name: adcs-rsa
    signature:
      allowed-algorithms:
        - "RSA-SHA256"
        - "RSA-SHA384"
        - "RSA-SHA512"
      min-rsa-bits: 4096
```

:::note
Lists must be written as block sequences (one `-` item per line). Hortval's
configuration parser does not accept YAML flow sequences (`["a", "b"]`) and
will refuse to start with `expected sequence (use '-' items)`.
:::

:::tip
Use a certificate template **dedicated** to Hortval — it lets the key
requirement, the SAN policy and the revocation permission be scoped to Hortval
without affecting your other templates. Run
[`hortval adcs check`](../configuration/adcs.md#preflight-your-setup-hortval-adcs-check)
to confirm the template is published and see its key requirement before you
start the server.
:::

## Windows refuses to run the binary on my server, and there is no way to continue {#smartscreen-no-bypass}

Symptom: you download `hortval-vX.Y.Z-windows-amd64.exe`, double-click it, and
get *"Windows protected your PC"* with a single **Don't run** button. Clicking
**More info** shows the publisher but offers no way through.

Nothing is wrong with the download. Two things are happening at once:

**The file carries the Mark of the Web** — an NTFS stream your browser attached
because it came from the Internet. That is what raises the prompt; a copy from
an internal share or a `curl.exe` download never shows it.

**Your server forbids the override.** The Microsoft Windows Server security
baseline sets *Configure Windows Defender SmartScreen* to **"Warn and prevent
bypass"**, which removes the *Run anyway* button by design. Check with:

```powershell
Get-ItemProperty 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' |
  Select-Object EnableSmartScreen, ShellSmartScreenLevel
```

`ShellSmartScreenLevel = Block` is that policy.

**The fix is not to weaken the policy.** Verify the signature, then clear the
mark — in that order, because unblocking is you asserting where the file came
from, and that assertion is only worth something once you have checked it:

```powershell
Get-AuthenticodeSignature .\hortval-vX.Y.Z-windows-amd64.exe | Format-List Status,SignerCertificate
# Status must be Valid, signer SAFE PIC TECHNOLOGIES

Unblock-File .\hortval-vX.Y.Z-windows-amd64.exe
```

The binary then starts normally. Full detail, including what SmartScreen
actually checks and what signing does and does not change:
[Verifying release binaries](../security/verifying-binaries.md).

:::tip Deploying to many servers
Fetch the release with `curl.exe`, an internal mirror or your software
distribution tool: none of them attaches the mark, so none of this applies.
Verify the signature once, on the copy you are about to distribute.
:::
