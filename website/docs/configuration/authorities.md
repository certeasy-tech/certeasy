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
| `configuration` | Yes | Type-specific configuration block (see below) |

## ADCS Authority

### Connector: native (default) or certreq.exe

Certeasy talks to ADCS through one of two interchangeable connectors. Both issue
the same certificates from the same `ca-name` and `certificate-template` — only
the integration method differs.

| `type` | Connector | Notes |
|---|---|---|
| `adcs` (default), `adcs-native` | **Native** — Certeasy enrolls in-process through the built-in Windows certificate API. No external program is launched. | Recommended. Nothing extra to install, and the cleanest fit for hardened, EDR-monitored hosts (see [Antivirus &amp; EDR](/administration/antivirus-edr)). |
| `adcs-cli` | **certreq.exe** — Certeasy drives the standard Windows `certreq.exe` tool. | Choose this if you prefer the classic `certreq.exe` integration, or want it as a fallback. |

`type: adcs` resolves to the native connector, so an existing configuration moves
to it automatically on upgrade — no change required. Both connectors are
Windows-only: ADCS enrollment runs on a Windows host joined to, or able to reach,
the CA.

### Configuration Fields

| Field | Default | Applies to | Description |
|---|---|---|---|
| `ca-name` | — | both | Full CA name as shown by `certutil -CA` (e.g. `PKI\LAB-RootCA`) |
| `certificate-template` | — | both | ADCS certificate template name for ACME issuance |
| `default-timeout` | `4m` | both | Maximum wait time for a single ADCS request. Keep it **below** `workers.max-job-duration` (default `5m`) so the ADCS timeout — not the surrounding job deadline — bounds the call; Certeasy warns at startup if it is greater than or equal to `max-job-duration`. |
| `certreq-path` | `certreq.exe` | `adcs-cli` only | Full path to `certreq.exe`. Ignored by the native connector. |

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
