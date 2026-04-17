---
sidebar_position: 2
title: Minimal Configuration
---

# Minimal Configuration

Certeasy is configured with a single YAML file. This page shows the smallest valid configuration to get started.

## Config File Location

Pass the config file explicitly:

```bash
certeasy.exe -f C:\certeasy\config.yml
```

Without `-f`, Certeasy searches for `config.yml` / `config.yaml` in:

1. Current directory
2. Executable directory
3. Windows: `%PROGRAMDATA%\certeasy`, then user config directory
4. Linux: `$XDG_CONFIG_HOME/certeasy`, then `/etc/certeasy`

## Minimal Example

This configuration relies on safe defaults wherever possible:

```yaml
server:
  url:
    - "https://acme.corp.internal"
  listen: ":8443"

tls-certificate-manager:
  bundles:
    - name: public
      mode: pki
      authority: ca1

dns-validation-profiles:
  - name: internal
    mode: local
    zones:
      - suffixes:
          - "corp.internal"
        system: true

authorities:
  - name: ca1
    type: adcs
    configuration:
      ca-name: "PKI\\LAB-RootCA"
      certificate-template: "ACME-Template-Server"

issuance-policies:
  - name: corp-server
    dns:
      allow:
        - ".corp.internal/3"
```

## What this configuration actually does

In plain English:

> Certeasy listens on port 8443 and exposes itself at `https://acme.corp.internal`.
> It contacts `LAB-RootCA` (your ADCS) to obtain a certificate for that hostname using the `ACME-Template-Server` template, and renews it automatically before expiry.
> It accepts ACME certificate requests for any name under `corp.internal` (up to 3 labels), validates challenges using the system DNS resolver, and forwards CSR signing to the same `LAB-RootCA`.

The authority `ca1` plays **two roles** here: it secures Certeasy's own HTTPS endpoint **and** signs the certificates your ACME clients request. Both use the same ADCS CA and the same template.

`ca-name` (`PKI\\LAB-RootCA`) is the name of your ADCS certification authority — the backslash-separated form is `<server>\<CA common name>`. You can retrieve the exact value with `certutil -CA` on the ADCS host. `certificate-template` (`ACME-Template-Server`) is the name of the certificate template configured in ADCS for ACME enrollment. See [ADCS Configuration](../configuration/adcs) for how to set up the template and permissions.

## Workers

Certeasy processes certificate orders (validation, CSR submission, renewals) through an internal job queue. By default, **4 workers** consume that queue in the background. You don't need to configure this for a standard deployment — the default handles the load of most environments. Workers are only worth tuning if you have a very high volume of concurrent requests.

## Implicit policy binding

This configuration has exactly one policy (`corp-server`) and one authority (`ca1`). Certeasy connects them automatically — no `policy-bindings` section is needed.

:::tip Think of it like a default route
With a single destination, you don't need a routing table. As soon as you add a second authority (e.g. a pre-production CA), Certeasy can no longer guess which policy routes where — you'll need to declare `policy-bindings` explicitly at that point.
:::

:::info How PKI-mode TLS works
On first startup, Certeasy submits a CSR to your ADCS for a certificate covering `acme.corp.internal` (taken from `server.url`). The certificate is cached locally and renewed automatically before expiry. No manual certificate provisioning required.

The issuance policy must cover the server hostname — `.corp.internal/3` handles `acme.corp.internal`.
:::

## What Each Section Does

| Section | Purpose |
|---|---|
| `server` | ACME endpoint URL and listen address |
| `tls-certificate-manager` | TLS certificate for the ACME HTTPS endpoint itself |
| `dns-validation-profiles` | How Certeasy resolves and validates DNS challenges |
| `authorities` | Your ADCS backend |
| `issuance-policies` | Which DNS names are allowed, key requirements |

## Startup Checklist

Before starting:

- [ ] `server.url` is set to the hostname ACME clients will use
- [ ] `ca-name` matches your ADCS CA exactly (check with `certutil -CA`)
- [ ] `certificate-template` exists in ADCS and is configured for ACME enrollment
- [ ] The service account has enroll permission on the template
- [ ] Work directory is writable

## Next Step

Once Certeasy starts successfully, follow the [First Certificate](/getting-started/first-certificate) guide to issue your first certificate.
