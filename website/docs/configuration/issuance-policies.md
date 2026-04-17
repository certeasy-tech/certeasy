---
sidebar_position: 4
title: Issuance Policies
---

# Issuance Policies

Issuance policies define **which certificate requests Certeasy will accept** and what constraints apply. Every order is evaluated against an issuance policy before any certificate is issued.

## Configuration

```yaml
issuance-policies:
  - name: corp-server
    dns-validation-profile: internal-default
    dns:
      allow:
        - ".corp.internal/3"
        - "*.corp.internal"
      deny:
        - "=forbidden.corp.internal"
    signature:
      allowed-algorithms:
        - "RSA-SHA256"
        - "RSA-SHA384"
        - "RSA-SHA512"
        - "ECDSA-SHA256"
        - "ECDSA-SHA384"
        - "ECDSA-SHA512"
        - "ED25519"
      min-rsa-bits: 3072
      allowed-ec-curves:
        - "P-256"
        - "P-384"
```

## Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique policy name |
| `dns-validation-profile` | Conditional | Profile to use for challenge validation. Required if more than one profile exists. |
| `dns.allow` | Yes | DNS scope rules (see below). Must not be empty. |
| `dns.deny` | No | DNS names to explicitly reject |
| `signature.allowed-algorithms` | No | Allowed signing algorithms. Empty = secure defaults. |
| `signature.min-rsa-bits` | No | Minimum RSA key size. Default: `3072`. |
| `signature.allowed-ec-curves` | No | Allowed EC curves. Empty = secure defaults. |

## DNS Scope Rules

The `dns.allow` list controls which DNS names Certeasy will accept in a CSR. Each rule uses a compact grammar.

### Rule: Non-wildcard zone with depth limit

**Syntax:** `.zone/N`

Allows non-wildcard names under `zone` with at most `N` labels before the zone.

```
.corp.internal/2
```

Allowed: `app.corp.internal`, `api.app.corp.internal`  
Rejected: `a.b.c.corp.internal` (3 labels), `*.corp.internal` (wildcard)

### Rule: Wildcard only at zone

**Syntax:** `*.zone`

Allows only the exact wildcard `*.zone`. Does not allow non-wildcard names.

```
*.corp.internal
```

Allowed: `*.corp.internal`  
Rejected: `app.corp.internal`, `*.sub.corp.internal`

To allow both, combine two rules:
```yaml
allow:
  - ".corp.internal/2"
  - "*.corp.internal"
```

### Rule: Wildcard in subzones only

**Syntax:** `*..zone/N`

Allows wildcards inside subzones of `zone`, but not directly under `zone`.

```
*..corp.internal/2
```

Allowed: `*.app.corp.internal`  
Rejected: `*.corp.internal` (directly under zone), `*.a.b.corp.internal` (too deep for `/2`)

### Rule: Exact match

**Syntax:** `=name`

Allows or denies an exact DNS name.

```yaml
deny:
  - "=legacy.corp.internal"
```

## DNS Name Normalization

Before matching, all DNS names are:
- Lowercased
- Trailing dot removed
- Rejected if they contain empty labels (`..`) or whitespace

## Signature Defaults

If `signature` is omitted:

- `min-rsa-bits`: `3072`
- `allowed-algorithms`: when empty, all supported algorithms are accepted — `RSA-SHA256`, `RSA-SHA384`, `RSA-SHA512`, `ECDSA-SHA256`, `ECDSA-SHA384`, `ECDSA-SHA512`, `ED25519`
- `allowed-ec-curves`: internal secure defaults (P-256, P-384)

## Multiple Policies

You can define multiple issuance policies for different environments or certificate types:

```yaml
issuance-policies:
  - name: corp-servers
    dns-validation-profile: internal
    dns:
      allow:
        - ".corp.internal/3"

  - name: dmz-servers
    dns-validation-profile: dmz
    dns:
      allow:
        - ".dmz.example.com/2"
```

When multiple policies exist, you must define explicit [policy bindings](/configuration/policy-bindings).
