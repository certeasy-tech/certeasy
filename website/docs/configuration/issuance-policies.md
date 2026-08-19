---
sidebar_position: 4
title: Issuance Policies
---

# Issuance Policies

Issuance policies define **which certificate requests Hortval will accept** and what constraints apply. Every order is evaluated against an issuance policy before any certificate is issued.

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
| `signature.allowed-algorithms` | No | Allowed signing algorithms. Empty = secure defaults. **A non-empty list replaces the defaults — it does not add to them.** |
| `signature.min-rsa-bits` | No | Minimum RSA key size. Default: `3072`. Floor: `2048`. |
| `signature.allowed-ec-curves` | No | Allowed EC curves. Empty = secure defaults. **A non-empty list replaces the defaults — it does not add to them.** |

## DNS Scope Rules

The `dns.allow` list controls which DNS names Hortval will accept in a CSR. Each rule uses a compact grammar.

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

## CSR Extension Whitelist (Extended Key Usage)

Hortval validates the contents of the CSR's `extensionRequest` strictly: only DNS-typed SANs and the Extended Key Usage extension (EKU, OID `2.5.29.37`) are accepted. By default the **only EKU value tolerated is `serverAuth`** (OID `1.3.6.1.5.5.7.3.1`) — the appropriate purpose for a public-server TLS certificate.

To accept additional EKU values, opt in per policy:

```yaml
issuance-policies:
  - name: lab-server
    csr:
      allowed-extra-eku:
        - clientAuth
        # - codeSigning
        # - emailProtection
        # - timeStamping
        # - ocspSigning
        # - anyPurpose
        # - "1.3.6.1.4.1.311.10.3.4"   # raw OID also accepted
```

`serverAuth` is implicit and does not need to be listed.

:::warning Security
Adding entries to `allowed-extra-eku` lets ACME clients request certificates with non-server-TLS purposes through that policy. Whether the issued certificate actually carries those EKUs depends on the back-end CA template:

- **ADCS templates configured as "Build from this Active Directory information"** ignore the CSR's EKU and apply the template's own. Adding entries here has no effect on the issued cert.
- **ADCS templates configured as "Supply in the request"** honor the CSR's EKU. The issued cert will carry whatever the CSR asked for, as long as the template permits it.

Only loosen this for policies whose authority you trust to enforce purpose constraints — e.g. a dedicated code-signing authority + template + audit trail. For the typical "Web Server" use case, leave it empty.
:::

### Note on `clientAuth` and the CA/B Forum baseline

For most of TLS history, server certificates routinely declared both `serverAuth` and `clientAuth` in their Extended Key Usage. Some popular ACME clients still do this by default — notably **acme.sh**, whose built-in CSR template emits `extendedKeyUsage = serverAuth, clientAuth`. Without `clientAuth` in `allowed-extra-eku`, those CSRs are refused.

The CA/B Forum's TLS Baseline Requirements **forbid this combination from June 2026 onwards**: a publicly-trusted server certificate must declare `serverAuth` only. Hortval is most often deployed against an internal ADCS — outside the public WebPKI — so the rule is advisory rather than binding for your deployment, but mirroring the public-trust posture is good hygiene.

Two practical positions:

1. **Strict (recommended for new deployments)**: leave `allowed-extra-eku` empty. Use lego or certbot, which emit `serverAuth` only by default. acme.sh works after a one-line override of its OpenSSL template.
2. **Pragmatic (existing acme.sh fleet)**: add `clientAuth` to `allowed-extra-eku` so existing scripts keep working, and plan a migration once the fleet has moved off acme.sh's default template.

## Signature Defaults

If `signature` is omitted:

- `min-rsa-bits`: `3072`
- `allowed-algorithms`: when empty, a secure default set applies — `RSA-SHA256`, `RSA-SHA384`, `RSA-SHA512`, `ECDSA-SHA256`, `ECDSA-SHA384`, `ED25519`
- `allowed-ec-curves`: internal secure defaults (P-256, P-384)

The default set is deliberately **narrower** than what you may configure. The
full configurable set adds `ECDSA-SHA512`; anything outside it is rejected when
the configuration is loaded, not at issuance time.

## Two rules that decide what a policy really accepts

Most surprises with `signature` come from these two, and they compound.

### 1. The lists replace the defaults, they do not extend them

Writing one value does not add it to the defaults — it **discards** the rest.
`allowed-ec-curves: ["P-521"]` does not mean "P-256, P-384 and also P-521"; it
means "P-521 only".

This is deliberate: it is what lets you constrain a policy to match a back-end CA
template (see [FAQ — reject a wrong key early](../reference/faq.md)). But it means
you must list **every** value you want.

### 2. Each EC curve is pinned to one algorithm

| Curve | Requires |
|---|---|
| `P-256` | `ECDSA-SHA256` |
| `P-384` | `ECDSA-SHA384` |
| `P-521` | `ECDSA-SHA512` |

Allowing a curve without its algorithm — or an algorithm without its curve —
makes that entry unusable.

### What each configuration actually accepts

| Configuration | RSA | P-256 | P-384 | P-521 | Ed25519 |
|---|:--:|:--:|:--:|:--:|:--:|
| no `signature` block | ✅ | ✅ | ✅ | ❌ | ✅ |
| `allowed-ec-curves: ["P-521"]` only | ✅ | ❌ | ❌ | ❌ | ✅ |
| `allowed-algorithms: ["ECDSA-SHA512"]` only | ❌ | ❌ | ❌ | ❌ | ❌ |
| both, `P-521` / `ECDSA-SHA512` only | ❌ | ❌ | ❌ | ✅ | ❌ |
| every algorithm **and** every curve listed | ✅ | ✅ | ✅ | ✅ | ✅ |

Row 2 is the common trap: adding `P-521` on its own loses P-256 and P-384 (rule 1)
**and** does not enable P-521 (rule 2). To add a curve, write both lists in full:

```yaml
signature:
  allowed-ec-curves:
    - "P-256"
    - "P-384"
    - "P-521"          # added
  allowed-algorithms:
    - "RSA-SHA256"
    - "RSA-SHA384"
    - "RSA-SHA512"
    - "ECDSA-SHA256"
    - "ECDSA-SHA384"
    - "ECDSA-SHA512"   # added — required by P-521
    - "ED25519"
```

:::tip Hortval tells you before your clients do
Any entry you wrote that cannot take effect is reported at startup **and** by
`hortval validate`, naming the policy and what to add:

```
issuance policy "corp": allowed-ec-curves lists P-521, but allowed-algorithms
does not allow ECDSA-SHA512 — the only algorithm that curve can be used with.
No certificate on that curve can be issued. Add ECDSA-SHA512 to
allowed-algorithms, or drop the curve
```

Startup also logs the rules in force for each policy, so you can check what a
narrowed configuration ended up accepting. A policy that can issue **nothing** is
refused outright at startup rather than failing every order at finalize.
:::

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

When multiple policies exist, you must define explicit [policy bindings](./policy-bindings.md).
