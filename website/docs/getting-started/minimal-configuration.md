---
sidebar_position: 4
title: Minimal configuration
---

# Minimal Configuration

Hortval is configured with a single YAML file. This page shows the smallest valid configuration to get started.

:::tip Quick start
If you'd rather have a working configuration generated for you, the
[Quick start with the wizard](wizard.md) walks you through the same fields
interactively and writes the YAML file for you.
:::

## Config File Location

Pass the config file explicitly:

```bash
hortval.exe -f C:\hortval\config.yml
```

Without `-f`, Hortval searches for `config.yml` / `config.yaml` in:

1. Executable directory
2. Windows: `%PROGRAMDATA%\hortval`, then `%APPDATA%\hortval`
   Linux: `/etc/hortval`, then `$XDG_CONFIG_HOME/hortval`
3. The same two directories named `certeasy` — the pre-rename location, still
   read, with a warning at startup. It will be removed in v2.

Machine-wide comes before per-user on purpose: the per-user directory is the one
an unprivileged account can write to.

:::warning The current directory is no longer searched
Up to v0.9.4 the working directory came first. A `config.yml` sitting in any
directory someone could write to therefore took precedence over the one in
`/etc` — and the configuration file selects the database, the working directory,
the audit log destination and the outbound proxy. Pass `-f` if you were relying
on it, or move the file to one of the locations above.
:::

:::warning Two configuration files is an error, not a priority list
If more than one of those files exists, Hortval refuses to start and names them
all. No directory wins over another: pass `-f` to say which one to use, or
remove the others. A file that silently shadows another is how a deployment ends
up running a configuration nobody meant to apply.
:::

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

> Hortval listens on port 8443 and exposes itself at `https://acme.corp.internal`.
> It contacts `LAB-RootCA` (your ADCS) to obtain a certificate for that hostname using the `ACME-Template-Server` template, and renews it automatically before expiry.
> It accepts ACME certificate requests for any name under `corp.internal` (up to 3 labels), validates challenges using the system DNS resolver, and forwards CSR signing to the same `LAB-RootCA`.

The authority `ca1` plays **two roles** here: it secures Hortval's own HTTPS endpoint **and** signs the certificates your ACME clients request. Both use the same ADCS CA and the same template.

`ca-name` (`PKI\\LAB-RootCA`) is the name of your ADCS certification authority — the backslash-separated form is `<server>\<CA common name>`. You can retrieve the exact value with `certutil -CA` on the ADCS host. `certificate-template` (`ACME-Template-Server`) is the name of the certificate template configured in ADCS for ACME enrollment. See [ADCS Configuration](../configuration/adcs) for how to set up the template and permissions.

## Workers

Hortval processes certificate orders (validation, CSR submission, renewals) through an internal job queue. By default, **16 workers** consume that queue in the background. You don't need to configure this for a standard deployment — the default handles the load of most environments. Workers are only worth tuning if you have a very high volume of concurrent requests.

## Implicit policy binding

This configuration has exactly one policy (`corp-server`) and one authority (`ca1`). Hortval connects them automatically — no `policy-bindings` section is needed.

:::tip Think of it like a default route
With a single destination, you don't need a routing table. As soon as you add a second authority (e.g. a pre-production CA), Hortval can no longer guess which policy routes where — you'll need to declare `policy-bindings` explicitly at that point.
:::

:::info How PKI-mode TLS works
On first startup, Hortval submits a CSR to your ADCS for a certificate covering `acme.corp.internal` (taken from `server.url`). The certificate is cached locally and renewed automatically before expiry. No manual certificate provisioning required.

The issuance policy must cover the server hostname — `.corp.internal/3` handles `acme.corp.internal`.
:::

## What Each Section Does

| Section | Purpose |
|---|---|
| `server` | ACME endpoint URL and listen address |
| `tls-certificate-manager` | TLS certificate for the ACME HTTPS endpoint itself |
| `dns-validation-profiles` | How Hortval resolves and validates DNS challenges |
| `authorities` | Your ADCS backend |
| `issuance-policies` | Which DNS names are allowed, key requirements |

## Startup checklist

Before starting:

- [ ] `server.url` is set to the hostname ACME clients will use
- [ ] `ca-name` matches your ADCS CA exactly (check with `certutil -CA`)
- [ ] `certificate-template` exists in ADCS and is configured for ACME enrollment
- [ ] The service account has enroll permission on the template
- [ ] Work directory is writable

## Next step

The configuration file is now in place, but `hortval serve` will refuse to start without an active license — or an explicit **cold-start window** opened for evaluation. The [License](./license.md) page covers both paths:

- Register or import the license you received from the portal, or
- Open a 1-week cold-start window with `hortval cold-start init --plan=<plan>` to evaluate.

Then proceed to the [First certificate](./first-certificate.md) guide.
