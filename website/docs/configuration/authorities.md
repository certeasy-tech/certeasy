---
sidebar_position: 6
title: Authorities
---

# Authorities

Authorities are the PKI backends that Hortval submits certificate requests to. Each authority represents one ADCS instance (or a fake PKI for testing).

## Configuration

```yaml
authorities:
  - name: ca1
    type: adcs                 # native connector (default) — see "Connector" below
    configuration:
      ca-name: "PKI\\LAB-RootCA"
      certificate-template: "ACME-Template-Server"
      default-timeout: 4m
```

## Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique authority name. Referenced in policy bindings. |
| `type` | Yes | Authority type: `adcs` / `adcs-native` (native connector, default) · `adcs-cli` (certreq.exe connector) · `fake` (testing) |
| `policies` | No | Remote authority policy constraints (advanced). If omitted, all local policies are candidates. |
| `disable-ca-revocation` | No (default `false`) | When `true`, keep ACME revocations local to Hortval instead of propagating them to the backing CA (CRL/OCSP). Leave unset (or `false`) to propagate. See [Revocation](#revocation). |
| `configuration` | Yes | Type-specific configuration block (see below) |

## ADCS Authority

### Connector: native (default) or certreq.exe

Hortval talks to ADCS through one of two interchangeable connectors. Both issue
the same certificates from the same `ca-name` and `certificate-template` — only
the integration method differs.

| `type` | Connector | Notes |
|---|---|---|
| `adcs` (default), `adcs-native` | **Native** — Hortval enrolls in-process through the built-in Windows certificate API. No external program is launched. | Recommended. Nothing extra to install, and the cleanest fit for hardened, EDR-monitored hosts (see [Antivirus &amp; EDR](../administration/antivirus-edr.md)). |
| `adcs-cli` | **certreq.exe** — Hortval drives the standard Windows `certreq.exe` tool. | Choose this if you prefer the classic `certreq.exe` integration, or want it as a fallback. |

`type: adcs` resolves to the native connector, so an existing configuration moves
to it automatically on upgrade — no change required. Both connectors are
Windows-only: ADCS enrollment runs on a Windows host joined to, or able to reach,
the CA.

:::tip Prefer the native connector at scale
On large or high-throughput deployments, **use the native connector** (`adcs` /
`adcs-native`). It runs in-process and bounds concurrency to the worker pool,
whereas `adcs-cli` **spawns a child process per operation** (`certreq.exe` to
issue, `certutil.exe` to revoke) — process-creation overhead, temp-file churn and
OS process limits add up under load. Keep `adcs-cli` for compatibility or as a
fallback, not for heavy issuance/revocation volume.
:::

### Configuration Fields

| Field | Default | Applies to | Description |
|---|---|---|---|
| `ca-name` | — | both | Full CA name as shown by `certutil -CA` (e.g. `PKI\LAB-RootCA`) |
| `certificate-template` | — | both | ADCS certificate template name for ACME issuance |
| `default-timeout` | `4m` | both | Maximum wait time for a single ADCS request. Keep it **below** `workers.max-job-duration` (default `5m`) so the ADCS timeout — not the surrounding job deadline — bounds the call; Hortval warns at startup if it is greater than or equal to `max-job-duration`. |
| `certreq-path` | system directory | `adcs-cli` only | Path to `certreq.exe` (enrollment). Ignored by the native connector. |
| `certutil-path` | system directory | `adcs-cli` only | Path to `certutil.exe`, used for **revocation** (`certutil -revoke`). `certutil` is a different binary from `certreq`. Ignored by the native connector. Only relevant when revocation propagation is enabled (i.e. `disable-ca-revocation` is not set). |

**Since 0.9.4**, both binaries are taken from the Windows system directory
(typically `C:\Windows\System32`) instead of being looked up through `%PATH%`.
Leaving the key unset — or giving just a file name, with or without the `.exe`
extension — resolves there.

Set a full path only to run a copy kept elsewhere, for instance on a dedicated
path carved out of an Endpoint Detection and Response (EDR) policy:

```yaml
      certutil-path: "C:\\Tools\\certutil.exe"
```

A path relative to the working directory (`tools\certutil.exe`) is refused at
startup and by `hortval validate`.

### Finding your CA Name

```powershell
certutil -CA
```

The output shows the CA name in the format `Machine\CAName`. Use this exact string in `ca-name`.

### Certificate Template Requirements

The ADCS template must:
- Allow enrollment by the Hortval service account
- Be configured for **Web Server** or equivalent (Server Authentication EKU)
- Not have conflicting subject policies that would override the CSR

:::tip
Create a dedicated template for Hortval (e.g. `ACME-Template-Server`) rather than reusing an existing one. This isolates the configuration and simplifies auditing.
:::

### Revocation

When an ACME client revokes a certificate (RFC 8555 §7.6), Hortval marks it
revoked in its own database and, by default, **propagates the revocation to the
backing CA** so the certificate also appears revoked in the CA's CRL/OCSP.

```yaml
authorities:
  - name: ca1
    type: adcs
    disable-ca-revocation: false   # default — propagate to the CA's CRL/OCSP
    configuration:
      ca-name: "PKI\\LAB-RootCA"
      certificate-template: "ACME-Template-Server"
```

**Revocation requires higher privileges than enrollment.** Issuing certificates
needs only *Read* + *Enroll* on the template and *Request Certificates* on the
CA. Revoking requires the **Certificate Manager** role — the *Issue and Manage
Certificates* permission on the CA. If the Hortval service account lacks it,
enrollment keeps working but revocation fails with an *Access Denied* error
(surfaced in the audit log as `certificate.revoke.publish_failed`).

Revocation is **asynchronous**: the ACME client receives its `200` immediately,
and Hortval publishes to the CA in the background, retrying with an escalating
backoff (minutes to hours) if the CA is temporarily unreachable. RFC 8555 §7.6
does not require publication to be confirmed before responding.

Set `disable-ca-revocation: true` to keep revocation **local to Hortval** (no CA
propagation). This is appropriate when:

- the service account cannot be granted the Certificate Manager role, or
- you intentionally rely on short-lived certificates and local revocation only.

Note that this is a **privilege** decision, not a connectivity one: revocation
targets the same CA host and channel as enrollment, so a CA reachable enough to
issue is reachable enough to revoke.

With propagation disabled, the audit log records `certificate.revoke.skipped`
instead of `certificate.revoke.published`.

Two authorization modes are accepted, per RFC 8555 §7.6:

- **Account key** — the account that owns the certificate signs the request.
- **Certificate key** — the request is signed with the certificate's own private
  key (the canonical "the key has leaked, revoke it" path). This works even
  without the issuing account, since possession of the private key is the proof.

The following CRL reason codes are accepted: `0` unspecified, `1` keyCompromise,
`2` cACompromise, `3` affiliationChanged, `4` superseded, `5`
cessationOfOperation, `9` privilegeWithdrawn, `10` aACompromise. The stateful
codes `6` (certificateHold) and `8` (removeFromCRL) are rejected, because
Hortval revocation is terminal (no hold/un-revoke lifecycle).

## Fake PKI Authority (Testing)

The `fakepki` authority type is a built-in self-signed CA for local testing. It does not connect to any external system.

```yaml
authorities:
  - name: test-ca
    type: fake
    configuration:
      common-name: "Hortval Test CA"
      password: "testpassword"
      key-size: 4096
      validity: 3650            # CA certificate lifetime, in days
      certificate-validity: 2160h   # issued-certificate lifetime (default 90 days)
```

### Fake PKI Configuration Fields

| Field | Description |
|---|---|
| `common-name` | CN of the fake CA certificate. **Required.** |
| `password` | Password encrypting the CA key on disk. **Required** — whoever reads that file otherwise becomes the authority. |
| `key-size` | RSA key size for the CA, **applied only when the CA is generated**. Defaults to `4096` when omitted. |
| `validity` | Lifetime of the **CA** certificate, in days. Defaults to `3650` when omitted. |
| `certificate-validity` | Lifetime of **issued** certificates (Go duration, e.g. `2160h`). Also bounds the CRL: a revoked serial is purged at `RevocationTime + certificate-validity` (it would be expired anyway), so the CRL cannot grow without bound. Default 90 days. |

:::info The CA key cannot be weaker than what it signs
`key-size` must be at least the highest `min-rsa-bits` of the issuance policies
bound to this authority — `3072` by default — with a hard floor of `2048`. A CA
signing 3072-bit certificates with a 2048-bit key is refused at startup, and by
`hortval validate`.
:::

:::caution `key-size` only applies when the CA is generated
An existing `ca.key` is loaded as it stands and is **never** regenerated —
replacing it would invalidate every certificate the authority has issued. So on
an authority that already has a CA, changing `key-size` changes nothing: the key
keeps the size it was created with, and the value in the configuration describes
an intention rather than what runs.

Hortval logs a warning at startup when the two disagree, giving the size in use
and the configured one. Moving to a stronger CA is a deliberate rollover: create
a new authority and re-issue, rather than editing this field.

Note the two checks fire at different moments. `key-size` against the policy
floor is a **static** check, so `hortval validate` and the startup gate both
refuse it before anything else happens. The `common-name` check compares the
configuration with the certificate on disk, so it can only run once the
authority is opened, later in startup.
:::

:::warning
The `fake` authority is for development and testing only. Do not use it in production.
:::

## Multiple Authorities

You can define multiple ADCS authorities for redundancy or to serve different policies:

```yaml
authorities:
  - name: adcs-primary
    type: adcs
    configuration:
      ca-name: "PKI\\Primary-CA"
      certificate-template: "ACME-Server"

  - name: adcs-backup
    type: adcs
    configuration:
      ca-name: "PKI\\Backup-CA"
      certificate-template: "ACME-Server"
```

Then reference both in a [policy binding](./policy-bindings.md) with `strategy: first_available`.
