---
sidebar_position: 6
title: Authorities
---

# Authorities

Authorities are the PKI backends that Certeasy submits certificate requests to. Each authority represents one ADCS instance (or a fake PKI for testing).

## Configuration

```yaml
authorities:
  - name: ca1
    type: adcs
    configuration:
      ca-name: "PKI\\LAB-RootCA"
      certificate-template: "ACME-Template-Server"
      certreq-path: "C:\\Windows\\System32\\certreq.exe"
      default-timeout: 10m
      cert-util-timeout: 30s
```

## Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique authority name. Referenced in policy bindings. |
| `type` | Yes | Authority type: `adcs` or `fake` |
| `policies` | No | Remote authority policy constraints (advanced). If omitted, all local policies are candidates. |
| `configuration` | Yes | Type-specific configuration block (see below) |

## ADCS Authority

### Configuration Fields

| Field | Default | Description |
|---|---|---|
| `ca-name` | — | Full CA name as shown by `certutil -CA` (e.g. `PKI\LAB-RootCA`) |
| `certificate-template` | — | ADCS certificate template name for ACME issuance |
| `certreq-path` | `certreq.exe` | Full path to `certreq.exe` |
| `default-timeout` | `10m` | Maximum wait time for ADCS to issue the certificate |
| `cert-util-timeout` | — | Timeout for `certutil` operations |

### Finding your CA Name

```powershell
certutil -CA
```

The output shows the CA name in the format `Machine\CAName`. Use this exact string in `ca-name`.

### Certificate Template Requirements

The ADCS template must:
- Allow enrollment by the Certeasy service account
- Be configured for **Web Server** or equivalent (Server Authentication EKU)
- Not have conflicting subject policies that would override the CSR

:::tip
Create a dedicated template for Certeasy (e.g. `ACME-Template-Server`) rather than reusing an existing one. This isolates the configuration and simplifies auditing.
:::

## Fake PKI Authority (Testing)

The `fakepki` authority type is a built-in self-signed CA for local testing. It does not connect to any external system.

```yaml
authorities:
  - name: test-ca
    type: fake
    configuration:
      common-name: "Certeasy Test CA"
      password: "testpassword"
      key-size: 2048
      validity: 8760h
```

### Fake PKI Configuration Fields

| Field | Description |
|---|---|
| `common-name` | CN of the fake CA certificate |
| `password` | Password for the CA key store |
| `key-size` | RSA key size for the CA |
| `validity` | Validity period for issued certificates |

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

Then reference both in a [policy binding](/configuration/policy-bindings) with `strategy: first_available`.
