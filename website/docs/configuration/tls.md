---
sidebar_position: 8
title: TLS Certificate Manager
---

# TLS Certificate Manager

The `tls-certificate-manager` section configures the TLS certificate that Certeasy uses for its **own HTTPS endpoint** — not the certificates it issues to clients.
Every hostname listed in `server.url` must be covered by exactly one bundle, or the server will not start.

## Configuration

```yaml
tls-certificate-manager:
  bundles:
    - name: public
      hosts:
        - "acme.corp.internal"
      mode: files
      local-cert-file: "C:\\certeasy\\tls\\fullchain.pem"
      local-key-file: "C:\\certeasy\\tls\\privkey.pem"
  file-watch-interval: 60s
```

## Bundles

A bundle associates a set of hostnames with a TLS certificate source. At least one bundle is required.
For an external name you can use a Let's Encrypt certificate; for an internal name you can use your ADCS certificate.

### Common fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Bundle identifier |
| `hosts` | list of strings | Conditional | Hostnames this bundle serves. Can be omitted if there is only one bundle. |
| `mode` | string | Yes | Certificate source: `files` or `pki` |

### `files` mode fields

| Field | Type | Required | Description |
|---|---|---|---|
| `local-cert-file` | string | Yes | Path to the PEM certificate chain |
| `local-key-file` | string | Yes | Path to the PEM private key |

### `pki` mode fields

| Field | Type | Required | Description |
|---|---|---|---|
| `authority` | string | Yes | Name of the authority to use for auto-issuance and renewal |


## Modes

### `files` — Static Files

Certeasy reads the certificate and key from disk. Use this when you manage the server certificate externally (e.g. via another ACME client or manual renewal).

```yaml
bundles:
  - name: public
    mode: files
    local-cert-file: "C:\\certeasy\\tls\\fullchain.pem"
    local-key-file: "C:\\certeasy\\tls\\privkey.pem"
```

Certeasy watches the files for changes and reloads automatically (controlled by `file-watch-interval`).

| Field | Default | Description |
|---|---|---|
| `file-watch-interval` | `5s` | How often to check for certificate file changes |


### `pki` — Auto-renewal via Internal PKI

Certeasy issues and renews its own server certificate through one of its configured authorities. The certificate is cached locally.

```yaml
bundles:
  - name: public
    mode: pki
    authority: ca1
```

This is the recommended mode for fully automated certificate management.

| Field | Default | Description |
|---|---|---|
| `acquire-timeout` | `2m` | Timeout to acquire a certificate at startup |
| `renew-before` | `720h` (30 days) | How early to start renewal before expiry |
| `pki-poll-interval` | `2s` | Polling interval when waiting for PKI issuance |
| `local-pki-cache-dir` | `%WORKDIR%/server-certificate-cache` | Directory to cache PKI-issued server certificates |

## Multiple Bundles

If you serve Certeasy on multiple hostnames, define one bundle per hostname group:

```yaml
tls-certificate-manager:
  bundles:
    - name: internal
      hosts:
        - "acme.corp.internal"
      mode: files
      local-cert-file: "/etc/certeasy/tls/internal.pem"
      local-key-file: "/etc/certeasy/tls/internal.key"

    - name: dmz
      hosts:
        - "acme.dmz.example.com"
      mode: files
      local-cert-file: "/etc/certeasy/tls/dmz.pem"
      local-key-file: "/etc/certeasy/tls/dmz.key"
```

