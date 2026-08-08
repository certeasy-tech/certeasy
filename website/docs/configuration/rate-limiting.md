---
sidebar_position: 10
title: Rate Limiting
---

# Rate Limiting

Hortval enforces several rate limits to protect the ACME endpoint from abuse and to prevent runaway clients from issuing thousands of certificates for the same names. All limits are configurable and individually disablable.

The block lives at the top level of the configuration file. The defaults below apply when `rate-limiting` is omitted entirely — note the empty `whitelist`: **no IP bypasses rate limits unless you opt in explicitly** (secure by default).

```yaml
rate-limiting:
  whitelist:                           # Empty — no bypass by default

  global:
    enabled: true
    requests-per-minute: 1200
    burst: 100

  abuse:
    enabled: true
    abuses-before-block: 10
    recovery-per-minute: 20

  account-creation:
    enabled: true
    per-ip-per-hour: 10
    burst: 10

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

Rate limits are enforced at six layers, in order:

1. **Global per-IP** — token bucket on **every** endpoint, checked before any cryptographic work.
2. **Abuse per-IP** — marks an IP that behaves in a way no conformant client does.
3. **Operation-specific** — tighter caps on account creation (per IP) and order creation (per account).
4. **Duplicate Certificate** — DB-backed defense against repeat issuance for the same FQDN set.
5. **Failed Validation** — in-memory defense against clients with broken DNS / unreachable challenge targets.
6. **Pending Authorizations** — DB-backed cap on in-flight authzs per account.

When a limit is hit, the server replies with HTTP 429 (`urn:ietf:params:acme:error:rateLimited`) and a `Retry-After` header.

## Whitelist

**Empty by default.** Adding entries explicitly opts an IP or range out of IP-based limits — Hortval never auto-trusts private RFC 1918 ranges or any other network.

`whitelist` accepts both single IPs and CIDR ranges:

```yaml
rate-limiting:
  whitelist:
    - "127.0.0.1"
    - "10.0.0.0/8"
    - "2001:db8::/32"
```

Any client whose IP matches a whitelist entry bypasses `global`, `account-creation` **and `order-creation`**. The limits that remain in force are the ones that do not consult the source IP at all: `duplicate-certificate`, `failed-validation` and `pending-authorizations` — all account-scoped and database- or account-keyed. Whitelisting therefore removes the per-IP request and order ceilings, but not the issuance safeguards behind them.

Use this sparingly: typical setups don't need a whitelist at all.

In particular, **a shared frontend IP is not a reason to whitelist it**. If clients
reach Hortval through a reverse proxy, set `trusted-proxies` in the [`server`](./server.md)
section instead, so the limiters key on the real client address. Whitelisting the
proxy CIDR would exempt *every* client behind it — the aggregate volume stops
being throttled, but so does each individual client. Reserve the whitelist for a
source you control end to end, such as a monitoring probe.

## Global

Per-IP token bucket applied to every ACME endpoint that accepts a connection.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Set to `false` to disable the global limiter entirely |
| `requests-per-minute` | `1200` | Sustained rate per source IP |
| `burst` | `100` | Maximum tokens accumulated when idle |

This is a **comfort ceiling**, sized so a legitimate client is never the one it
stops. It now applies to every endpoint, including the polling a client does
while it waits for validation — issuing a 3-name certificate costs at least 18
requests, and considerably more when DNS propagation is slow. The defaults were
`200`/`20` in earlier versions, when the limiter only saw the four entry points.

Because it must stay generous, this bucket is not what stops abuse. That is the
next one.

## Abuse

Per-IP marking, not a request ceiling. An IP that behaves in a way **no
conformant client does** is marked, and a marked IP is then refused on
*everything* — not merely on further misbehaviour.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Set to `false` to disable marking entirely |
| `abuses-before-block` | `10` | Abuses tolerated before the IP is marked |
| `recovery-per-minute` | `20` | How fast a marked IP recovers |

Recovery is gradual rather than a fixed ban: an IP that stops misbehaving is
back to normal within roughly thirty seconds, and a client that slips once is
never marked at all. A fixed ban would take a misconfigured client out of
service with no way to release it.

**What marks an IP**

Not every mark weighs the same. The unit is one *confirmed* abuse, which is what
`abuses-before-block` counts.

| Weight | Situation |
|---|---|
| **1** — confirmed | A JWS whose signature does not verify, or whose envelope is malformed. |
| **1** — confirmed | Acting on a resource that exists and belongs to **another account** — authorization, challenge, certificate, account. |
| **¼** — suspected | An identifier that does not exist. |

The reduced weight is deliberate. A missing resource usually means someone is
probing identifiers at random, but not always: a client coming back to a URL
whose resource has since been cleaned up gets the same answer. Rather than try
to tell the two apart, the server makes the distinction unnecessary — a handful
of misses costs almost nothing, while systematic probing still blocks (four
misses make one abuse).

A dangling internal reference — the resource exists but what it points to does
not — marks **nothing at all**. That is our data being inconsistent, not the
client misbehaving.

**What deliberately does not**

- `badNonce`. It is routine: restarting the server invalidates every nonce in
  flight, and RFC 8555 requires clients to fetch a new one and retry. Counting
  it would throttle every client after each restart.
- An expired order or authorization, and any refusal that comes from your
  licence — those are not the client's doing.
- Policy refusals such as a rejected identifier or a rejected CSR. A correctly
  written but misconfigured client produces them repeatedly; they have their own
  limiters.

Marking is per address, so clients sharing one egress address share the mark: a
single misbehaving client can have the others refused with it. Where that address
belongs to a reverse proxy, `trusted-proxies` resolves it properly by exposing
the real client addresses. Where it is genuine NAT and the real addresses are
unrecoverable, weigh disabling `abuse` against whitelisting the address — both
give up the protection for that whole population, so the choice is which of the
two limiters you keep.

## Account Creation

Per-IP token bucket applied at `new-account`. Prevents an IP from registering an unbounded number of accounts.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | |
| `per-ip-per-hour` | `10` | Sustained rate of new accounts per IP |
| `burst` | `10` | Accounts that may be registered back to back |

The burst deliberately **equals** the hourly allowance. Creating an account is a
once-per-machine-for-life event — the client keeps its account key — so
legitimate traffic arrives in deployment waves with long silences between, not
at a steady rate. A smaller burst would spread out a budget you should be free
to spend at once, and would refuse the third machine of a batch provisioned
together behind one NAT egress address.

What this bucket really bounds is not the cost of an account — that is one row —
but the fact that an account **multiplies every per-account quota** below it. If
you provision more than ten machines at a time behind a single address, raise
both values together.

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

The Hortval deployment model is typically **one machine = one ACME account**. A single host issuing certificates for its own domains rarely has more than 5–10 pending authzs at once. 30 is generous for legitimate workflows and tight enough to catch runaway loops.

For multi-tenant deployments where one account fronts many machines, raise the cap explicitly.

### Why expired authzs are excluded

Hortval does not auto-purge expired authzs from the database (they remain visible for audit). Counting them would mean an account that abandons a few orders gets locked out **permanently**. The check uses `expires_at IS NULL OR expires_at > now()` to count only rows that are actually still in flight.

### Retry-After

If the cap is hit, `Retry-After` is the time until the soonest-expiring pending authz drops out of the count. The client wakes up exactly when one slot frees up.

## Tuning Recommendations

| Scenario | Suggested change |
|---|---|
| Internal PKI, few clients | Increase `requests-per-minute` and `orders-per-account-per-hour`; keep `duplicate-certificate` enabled |
| Many short-lived test environments | Lower `duplicate-certificate.max-per-window` to `2` to catch loops faster |
| Public-facing service | Keep all defaults; do not whitelist anything unless you have a specific reason |
| Behind a reverse proxy with shared egress IP | Configure `trusted-proxies` in `server` so client IPs are extracted correctly — the limiter will then key on real client IPs, not the proxy. Avoid whitelisting the proxy CIDR (it would let any client behind the proxy bypass IP limits) |
