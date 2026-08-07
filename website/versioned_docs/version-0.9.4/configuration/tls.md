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
surface. It also exposes a component of your PKI on the public internet — read
the trade-off below before choosing it. In most deployments `pki` or `files` is
the better answer.
:::

#### Why a public certificate — and what HTTP-01 costs you

**The value.** Every ACME client already trusts Let's Encrypt — it is in
`certifi`, in curl's bundle, in every OS store. A publicly-trusted certificate on
Certeasy therefore means **nothing to install and nothing to configure on the
client side**: no root to distribute, and no per-client trust-store setting to
push, before a machine can so much as talk to your ACME endpoint. That is the
whole reason this mode exists, and on a large fleet it removes a real bootstrap
problem.

**The cost.** HTTP-01 requires the challenge listener to be reachable from the
internet on port 80. That puts a component of your PKI on the public network.
For many deployments this is not a good architectural trade, and it is worth
saying plainly: this mode is offered, not recommended by default.

**Prefer, in this order:**

1. **`mode: pki` — an internal certificate from your own CA.** The elegant one:
   one chain of trust, nothing exposed publicly, no external dependency, no rate
   limits, and Certeasy's own certificate follows the same lifecycle as every
   certificate it issues.

   Its cost is real and worth stating, in two parts. Your root has to reach the
   trust store of every machine that talks to Certeasy — and those are the Linux
   servers, proxies, load balancers and containers that Active Directory does not
   reach. Group Policy already covers your Windows estate; it does not cover the
   population Certeasy exists for.

   And the OS trust store is not the end of it: **ACME clients do not all use
   it**. certbot reads Python's own bundle (`certifi`) and needs
   `REQUESTS_CA_BUNDLE`; lego reads a single PEM named by `LEGO_CA_CERTIFICATES`;
   acme.sh goes through curl and needs `--ca-bundle` or `CURL_CA_BUNDLE`. So the
   root has to be deployed *and* each client pointed at it, on every machine.
   Both steps are one-time work for your configuration management, and good
   practice for any internal TLS service — but they are steps, and they are per
   client. Each client page gives the specifics:
   [lego](/0.9.4/clients/lego), [certbot](/0.9.4/clients/certbot), [acme.sh](/0.9.4/clients/acme-sh).
2. **DNS-01 with a standalone ACME client, then `mode: files`.** When you want a
   publicly-trusted certificate — so clients need no internal CA at all, which is
   exactly the step option 1 asks of you — without exposing anything. Certeasy's
   file watcher reloads the pair when it changes on disk, so renewals are picked
   up without a restart (`file-watch-interval`, 5s by default).
3. **HTTP-01**, when the endpoint is already internet-facing anyway, or when you
   accept the exposure knowingly.

#### Setting it up

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

The Let's Encrypt Terms of Service are accepted automatically. If a bundle uses
`mode: letsencrypt` while `letsencrypt.enabled` is `false`, the server refuses to
start.

#### If you do use HTTP-01

**It is the only challenge Certeasy wires.** DNS-01 and TLS-ALPN-01 are not, and
no setting turns them on — for those, use option 2 above.

The listener is then the only thing you expose: `server.listen` can stay on an
internal interface, because Let's Encrypt only ever talks to the challenge
listener.

- It serves `/.well-known/acme-challenge/` and returns **404 for every other
  path** — no redirect, no reflection of the request.
- Only the hosts of your `letsencrypt` bundles get an answer there.
- `http-addr` accepts a full address, so you can bind it to one interface
  (`203.0.113.10:80`) and keep `server.listen` on another.

:::caution Not available on air-gapped installs
This mode needs **outbound** HTTPS to Let's Encrypt — account, orders, issuance —
on top of the **inbound** port 80 for the challenge. An air-gapped or
egress-filtered deployment cannot use it: choose `mode: pki` (option 1), or issue
the certificate on a connected machine and carry it in with `mode: files`.

Running disconnected also means running the licence offline — see
[Offline Mode (Air-Gapped)](/0.9.4/configuration/license#offline-mode-air-gapped),
which is the constraint to plan around first.
:::

:::warning Let's Encrypt validates HTTP-01 on port 80, always
Setting `http-addr` to another port (`:8080`) **only works behind a reverse proxy
that forwards public port 80 to it**. Let's Encrypt does not follow a different
port. Facing the internet directly, the listener must be on `:80`.
:::

#### DNS-01 support, by client

Support differs, and the difference matters when you pick one for option 2:

| Client | DNS-01 |
|---|---|
| [lego](https://go-acme.github.io/lego/) | Built-in providers, `--dns <provider>` |
| [acme.sh](https://github.com/acmesh-official/acme.sh) | Built-in DNS APIs, `--dns dns_<provider>` |
| [certbot](https://certbot.eff.org/) | Needs a `certbot-dns-*` plugin for your provider, or `--manual` with auth hooks you write |

```yaml
tls-certificate-manager:
  bundles:
    - name: public
      hosts: ["acme.example.com"]
      mode: files                 # certificate obtained elsewhere, e.g. DNS-01
      local-cert-file: "/etc/certeasy/fullchain.pem"
      local-key-file: "/etc/certeasy/privkey.pem"
```

:::info One failed authorization per issuance is expected
The bundled `autocert` client always attempts `tls-alpn-01` first and cannot be
told otherwise. That attempt fails — nothing answers it — and the client then
obtains the certificate over HTTP-01. You will see one invalid authorization per
issuance in your Let's Encrypt account history. This is well inside Let's
Encrypt's limit of 5 failed validations per hostname per hour: a certificate is
issued roughly every 60 days per host.
:::

| Field | Default | Description |
|---|---|---|
| `letsencrypt.enabled` | `false` | Master switch; must be `true` when any bundle uses `letsencrypt` mode |
| `letsencrypt.email` | — | ACME account email (renewal / expiry notices) |
| `letsencrypt.http-addr` | `:80` | Address where the HTTP-01 challenge server listens. Must be reachable on **public port 80** — use another port only behind a reverse proxy |
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

