---
sidebar_position: 10
title: Rate Limiting
---

# Rate Limiting

Certeasy enforces several rate limits to protect the ACME endpoint from abuse and to prevent runaway clients from issuing thousands of certificates for the same names. All limits are configurable and individually disablable.

The block lives at the top level of the configuration file. The defaults below apply when `rate-limiting` is omitted entirely — note the empty `whitelist`: **no IP bypasses rate limits unless you opt in explicitly** (secure by default).

```yaml
rate-limiting:
  whitelist:                           # Empty — no bypass by default

  global:
    enabled: true
    requests-per-minute: 200
    burst: 20

  account-creation:
    enabled: true
    per-ip-per-hour: 5
    burst: 2

  order-creation:
    enabled: true
    orders-per-account-per-hour: 20
    order-burst: 5
    san-budget-per-account-per-hour: 100

  duplicate-certificate:
    enabled: true
    max-per-window: 5
    window: 168h

  failed-validation:
    enabled: true
    max-per-window: 5
    window: 1h

  pending-authorizations:
    enabled: true
    max: 30
```

## How It Works

Rate limits are enforced at five layers, in order:

1. **Global per-IP** — token bucket on every entry endpoint (`new-account`, `new-order`, `revoke-cert`, `renewal-info`).
2. **Operation-specific** — tighter caps on account creation (per IP) and order creation (per account).
3. **Duplicate Certificate** — DB-backed defense against repeat issuance for the same FQDN set.
4. **Failed Validation** — in-memory defense against clients with broken DNS / unreachable challenge targets.
5. **Pending Authorizations** — DB-backed cap on in-flight authzs per account.

When a limit is hit, the server replies with HTTP 429 (`urn:ietf:params:acme:error:rateLimited`) and a `Retry-After` header.

## Whitelist

**Empty by default.** Adding entries explicitly opts an IP or range out of IP-based limits — Certeasy never auto-trusts private RFC 1918 ranges or any other network.

`whitelist` accepts both single IPs and CIDR ranges:

```yaml
rate-limiting:
  whitelist:
    - "127.0.0.1"
    - "10.0.0.0/8"
    - "2001:db8::/32"
```

Any client whose IP matches a whitelist entry bypasses **all** IP-based limits (`global`, `account-creation`). Account-scoped limits (`order-creation`, `duplicate-certificate`, `failed-validation`, `pending-authorizations`) still apply — whitelisting an IP does not grant unlimited issuance to the account behind it.

Use this sparingly: typical setups don't need a whitelist at all. The most common use case is whitelisting a known reverse-proxy CIDR when many clients share a frontend IP, so a single proxy doesn't get throttled by aggregate request volume.

## Global

Per-IP token bucket applied to every ACME endpoint that accepts a connection.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Set to `false` to disable the global limiter entirely |
| `requests-per-minute` | `200` | Sustained rate per source IP |
| `burst` | `20` | Maximum tokens accumulated when idle |

A burst of `20` and a sustained rate of `200/min` lets a client issue 20 quick requests, then refill at ~3.3/sec.

## Account Creation

Per-IP token bucket applied at `new-account`. Prevents an IP from registering an unbounded number of accounts.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | |
| `per-ip-per-hour` | `5` | Sustained rate of new accounts per IP |
| `burst` | `2` | Initial burst |

## Order Creation

Per-account, with two **independent** quotas:

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | |
| `orders-per-account-per-hour` | `20` | Order count quota — 1 token per order, regardless of size |
| `order-burst` | `5` | Initial burst on the order count quota |
| `san-budget-per-account-per-hour` | `100` | SAN budget — N tokens per N-SAN order |

The two quotas are independent: a multi-SAN order consumes more SAN budget but does not consume more burst on the order count. This lets a client issue a small number of large orders OR a larger number of small orders, but not both unboundedly.

## Duplicate Certificate

Anti-runaway defense, **DB-backed**. Counts non-revoked certificates issued to an account for the same canonical FQDN set within a rolling time window. Targeted at the most damaging failure mode: a misconfigured client looping on the same domain.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | |
| `max-per-window` | `5` | Maximum issuances per (account, FQDN set) per window |
| `window` | `168h` (7 days) | Rolling window for the count |

### How the FQDN set is canonicalised

Identifiers in the `newOrder` request are:

1. Lowercased
2. Trimmed of trailing dots
3. Validated as DNS names (LDH form)
4. Deduplicated
5. Sorted

Wildcards are preserved (`*.example.com` ≠ `example.com`). The canonical list is hashed with SHA-256 and stored on the order; subsequent orders comparing the same hash count toward the limit.

### Revoked certificates are excluded

Revoking a certificate frees a quota slot. This lets an operator legitimately re-issue after a key compromise without being locked out.

### Retry-After is precise

When the limit is hit, `Retry-After` is computed from the oldest in-window certificate: once it falls out of the rolling window, one slot frees up. Clients that respect `Retry-After` will wake up exactly when issuance becomes possible again, not earlier.

### When to disable

The duplicate-certificate limit is the primary protection against the "2000 certs for one site" scenario. Disabling it is reasonable only if:

- You operate a fully internal PKI with trusted, well-behaved clients
- You have alternative monitoring (e.g. cert volume alerts) in place

Disable it by setting `enabled: false`.

## Failed Validation

In-memory token bucket per `(account, hostname)`. Counts challenge failures (challenge transitioning to `invalid`) and refuses new authorizations for that pair once the cap is hit. Targets misconfigured clients with broken DNS, unreachable port 80, or wrong TLS-ALPN setup — without this, such clients endlessly retry and burn worker capacity.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | |
| `max-per-window` | `5` | Maximum failed validations per (account, hostname) per window |
| `window` | `1h` | Rolling window over which failures decay |

### How it works

- A challenge transition to `invalid` records one failure.
- The next `newOrder` request for the same hostname checks the counter:
  - If under the cap → order created normally.
  - If at the cap → HTTP 429 with `Retry-After` set to the time until at least one slot frees up.
- Counters live in memory only — they are lost on restart, which is fine: a misconfigured client that survives a restart will rediscover its broken setup within a few seconds and the counter will refill.
- Wildcards are separate from the base name (`*.example.com` and `example.com` have independent counters).

### Why in-memory and not DB-backed

The window is short (1h) and the goal is to short-circuit live abuse, not to enforce a long-term quota. Tracking in memory avoids DB writes on the hot failure path; an in-memory miss after a restart costs at most one extra burst of failures before the counter rebuilds.

### Implementation note

The counter increment runs **outside the database transaction** that marks the challenge invalid (via a `PostCommit` hook on the job effect). This avoids extending the SQLite write-lock duration with non-DB work.

## Pending Authorizations

Caps the number of **in-flight** pending authorizations per account. An "in-flight" authz is one whose row in `acme_authorizations` has `status='pending'` AND has not yet expired. Targets clients that create orders without ever finalizing them — abandoned orders accumulate authz rows and waste storage.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | |
| `max` | `30` | Maximum in-flight pending authzs per account |

### Why 30 by default

The CertEasy deployment model is typically **one machine = one ACME account**. A single host issuing certificates for its own domains rarely has more than 5–10 pending authzs at once. 30 is generous for legitimate workflows and tight enough to catch runaway loops.

For multi-tenant deployments where one account fronts many machines, raise the cap explicitly.

### Why expired authzs are excluded

CertEasy does not auto-purge expired authzs from the database (they remain visible for audit). Counting them would mean an account that abandons a few orders gets locked out **permanently**. The check uses `expires_at IS NULL OR expires_at > now()` to count only rows that are actually still in flight.

### Retry-After

If the cap is hit, `Retry-After` is the time until the soonest-expiring pending authz drops out of the count. The client wakes up exactly when one slot frees up.

## Tuning Recommendations

| Scenario | Suggested change |
|---|---|
| Internal PKI, few clients | Increase `requests-per-minute` and `orders-per-account-per-hour`; keep `duplicate-certificate` enabled |
| Many short-lived test environments | Lower `duplicate-certificate.max-per-window` to `2` to catch loops faster |
| Public-facing service | Keep all defaults; do not whitelist anything unless you have a specific reason |
| Behind a reverse proxy with shared egress IP | Configure `trusted-proxies` in `server` so client IPs are extracted correctly — the limiter will then key on real client IPs, not the proxy. Avoid whitelisting the proxy CIDR (it would let any client behind the proxy bypass IP limits) |
