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
  file-watch-interval: 5s
```

## Bundles

A bundle associates a set of hostnames with a TLS certificate source. At least one bundle is required.
For an external name you can use a Let's Encrypt certificate; for an internal name you can use your ADCS certificate.

### Common fields

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Bundle identifier |
| `hosts` | list of strings | Conditional | Hostnames this bundle serves. Can be omitted if there is only one bundle. |
| `mode` | string | Yes | Certificate source: `files`, `pki`, or `letsencrypt` (beta) |

### `files` mode fields

| Field | Type | Required | Description |
|---|---|---|---|
| `local-cert-file` | string | Yes | Path to the PEM certificate chain |
| `local-key-file` | string | Yes | Path to the PEM private key |

### `pki` mode fields

| Field | Type | Required | Description |
|---|---|---|---|
| `authority` | string | Yes | Name of the authority to use for auto-issuance and renewal |
| `key` | object | No | Key algorithm/size for the generated CSR. Defaults to ECDSA P-256. See [Key type](#key-type). |


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

#### Key type

By default Certeasy generates an **ECDSA P-256** key for its own server
certificate. If the backing CA rejects that key — most commonly an **ADCS
certificate template that mandates RSA** (e.g. minimum key size 4096, RSA
provider only) — set an explicit `key:` on the bundle so the generated CSR
matches what the template requires:

```yaml
bundles:
  - name: public
    mode: pki
    authority: ca1
    key:
      type: rsa      # "ecdsa" (default) or "rsa"
      size: 4096     # RSA only: modulus bits (default 3072)
      # For ECDSA use `curve:` instead of `size:`, e.g.:
      #   type: ecdsa
      #   curve: P-384   # P-256 (default) | P-384 | P-521
```

`size` and `curve` are mutually exclusive: `size` applies to RSA, `curve` to
ECDSA. The curve names match `allowed-ec-curves` in issuance policies.

| Field | Values | Default | Description |
|---|---|---|---|
| `key.type` | `ecdsa`, `rsa` | `ecdsa` | Key algorithm for the generated CSR |
| `key.size` | `2048`–`8192` | `3072` | RSA modulus bits (RSA only) |
| `key.curve` | `P-256`, `P-384`, `P-521` | `P-256` | ECDSA curve (ECDSA only) |

:::note
If the CA rejects the key type, issuance of the server certificate fails and
Certeasy does not start. With an RSA-only ADCS template you will see the CA
deny the request (`CERTSRV_E_KEY_LENGTH`) unless the bundle sets `key.type` to
`rsa`:

```yaml
    key:
      type: rsa
      size: 4096
```

See [ADCS authorities](./adcs.md).
:::

### `letsencrypt` — Public CA (Let's Encrypt) — beta

:::warning Beta
Let's Encrypt mode works but is not yet part of the formally supported release
surface. Use it for an **internet-facing** Certeasy endpoint that can answer a
public HTTP-01 challenge; for internal names use `files` or `pki`.
:::

For a **publicly resolvable** hostname, Certeasy obtains and auto-renews its own
HTTPS certificate directly from Let's Encrypt (via the built-in ACME `autocert`
client). Set the bundle to `mode: letsencrypt` and enable the manager-level
`letsencrypt:` account block; the bundle's `hosts` become the issuance whitelist.

```yaml
tls-certificate-manager:
  bundles:
    - name: public
      hosts:
        - "acme.example.com"       # must be publicly resolvable
      mode: letsencrypt

  letsencrypt:
    enabled: true                  # required when any bundle uses letsencrypt mode
    email: "pki@example.com"       # ACME account / expiry notices
    http-addr: ":80"               # where the HTTP-01 challenge is answered
    cache-dir: "%WORKDIR%/autocert"
```

The Let's Encrypt Terms of Service are accepted automatically. The `hosts` must be
publicly resolvable and reachable on `http-addr` (default `:80`) from the internet.
If a bundle uses `mode: letsencrypt` while `letsencrypt.enabled` is `false`, the
server refuses to start.

| Field | Default | Description |
|---|---|---|
| `letsencrypt.enabled` | `false` | Master switch; must be `true` when any bundle uses `letsencrypt` mode |
| `letsencrypt.email` | — | ACME account email (renewal / expiry notices) |
| `letsencrypt.http-addr` | `:80` | Address where the HTTP-01 challenge server listens |
| `letsencrypt.cache-dir` | — | Directory caching issued certificates and the account key (set explicitly, e.g. `%WORKDIR%/autocert`) |

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

