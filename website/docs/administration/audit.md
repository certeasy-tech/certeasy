---
sidebar_position: 6
title: Audit Log
---

# Audit Log

Hortval writes a tamper-evident audit log of business decisions and security-relevant events: account lifecycle, order creation, authorization outcomes, certificate issuance and revocation, rate-limit denials, and license transitions. Each line is HMAC-chained to the previous one so any insertion, deletion, or modification is detectable after the fact with the bundled `hortval audit verify` command.

The audit log is **enabled by default**: a silent opt-out would be a compliance hole. Disable it explicitly with `enabled: false` if you have a specific reason.

## Configuration

```yaml
audit:
  enabled: true
  path: ""
  rotate:
    max-size-mb: 0
```

Omitting the `audit` block applies the defaults shown above.

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Set to `false` to disable the audit writer entirely. No file is created and `Audit()` calls are dropped silently. |
| `path` | `""` | Base path for the audit log. Empty resolves to `<workdir>/audit.log`. With rotation enabled this is a **naming base**, not a file — see below. |
| `rotate.max-size-mb` | `0` | When greater than zero, Hortval starts a new segment once the current one exceeds this size. `0` means a single segment that grows indefinitely. |

:::danger Removed in v0.9.4 — `rotate.max-backups`
This field no longer exists, and **a configuration that still contains it is
refused at startup**. Remove it before upgrading.

The audit log is a compliance artifact, not a log: its value lies in being
complete. Deleting it by file count is not a setting, so the option was removed
rather than validated against. Retention will return expressed as a **duration**,
which is the unit a compliance requirement is actually written in.
:::

### Rotation is internal, and external rotation is not supported

:::danger Do not point logrotate at the audit file
Earlier versions of this page recommended a `logrotate` snippet with
`copytruncate`. **That recommendation was wrong and is withdrawn.**

A third party renaming or truncating the file breaks the HMAC chain, and
Hortval cannot distinguish that from tampering. Remove any `logrotate` rule,
Scheduled Task or backup job that rotates, truncates or moves `audit.path`.
Copying the closed segments elsewhere is fine — see below.
:::

Hortval segments the file itself. Each segment is named after the instant it
was opened and is **never renamed**:

```
audit.path: C:\ProgramData\hortval\audit\audit.log
  ->  C:\ProgramData\hortval\audit\audit.20260726T091702Z.ms123.log
```

Two consequences worth knowing:

- **A closed segment is immutable.** It is never reopened for writing, so an
  archiver can copy or move closed segments with no risk of catching a file
  mid-rotation. Leave the newest one alone: it is the one being written.
- **Hortval never deletes an audit segment.** Disk growth is bounded by your
  archival policy, not by the product. Sizing: at `max-size-mb: 100`, a busy
  enterprise CA produces on the order of a few segments per year.

If a rotation cannot complete — an antivirus holding the file, a full disk, a
permissions problem — Hortval keeps writing to the current segment and reports
the reason on stderr (captured by systemd and the Windows service manager). It
retries later. Nothing is lost and no history is touched.

## What Is Logged

The audit log captures decisions and security events. The list is intentionally narrow: nonce churn, individual JWS verifications, GET requests on the directory, and `/metrics` scrapes are explicitly excluded — they would drown the signal in noise without forensic value.

The tables below list every recorded event, what triggers it, and what extra context is attached in the `details` field. Common fields (`ts`, `account_id`, `source_ip`, `user_agent`) are described in [Line Format](#line-format) and are not repeated here.

### Account events

| Event | When | Details |
|---|---|---|
| `account.create` | A new ACME account is created. The dedupe path (existing key reused) is silent. | `contact`: list of contact URIs declared by the client |
| `account.keychange` | An account's JWK is rotated successfully via `keyChange`. | `old_thumbprint`, `new_thumbprint` |
| `account.deactivate` | An account is set to `deactivated` by its owner. | _(none)_ |

### Order and authorization events

| Event | When | Details |
|---|---|---|
| `order.create` | A new order is accepted and persisted. | `order_id`, `dns_names` (canonical: lowercased, sorted, deduped, wildcards preserved) |
| `order.finalize` | A `finalize` request has been accepted and the issuance job is enqueued. Represents the client's accepted finalize, not the actual cert issuance. | `order_id`, `policy_id`, `dns_names` |
| `order.invalid` | An order transitions to `invalid`. Emitted at most once per order — retries do not duplicate the event. The free-form `reason` field on the line carries the failure message. | `order_id`, `source`: `"challenge"` or `"pki"` |
| `authorization.validate` | An authorization transitions to `valid` (`decision: allow`) or `invalid` (`decision: deny`). Deny is emitted only when the authorization actually flips to invalid (i.e. all challenges of that authz failed). | `authz_id`, `identifier`, `chall_type` |
| `challenge.validate` | A challenge succeeds. **Failures are not recorded per challenge** — they would be too noisy. The chain "these challenges passed → this cert was issued" remains reconstructible from the order, authorization, and certificate events. | `chall_id`, `chall_type`, `identifier`, `authz_id` |

### Certificate events

| Event | When | Details |
|---|---|---|
| `certificate.issue` | A certificate has been issued and persisted. | `cert_id`, `order_id`, `pki_request_id`, `serial`, `dns_names` |
| `certificate.revoke` | A certificate is revoked via the `revoke-cert` endpoint. | `cert_id`, `fingerprint`, `reason` (RFC 5280 reason code; JSON `null` when the client did not provide one) |

### Rate limiting

| Event | When | Details |
|---|---|---|
| `ratelimit.deny` | A request is refused with HTTP 429. Emitted once per refusal. | `type`: one of `global`, `account-creation`, `order-creation`, `duplicate-certificate`, `failed-validation`, `pending-authorizations`; `retry_after` (seconds) |

### License

| Event | When | Details |
|---|---|---|
| `license.change` | The license state transitions between `valid`, `grace`, `expired`, `revoked`, or `no_license`. The boot baseline is not emitted — only subsequent transitions are. | `prev`, `next` |

## Line Format

The log is JSONL — one self-contained JSON object per line. Field order is fixed by the schema version (currently `"1"`).

```json
{"ts":"2026-05-08T14:32:11.123Z","schema":"1","seq":12345,"prev_mac":"hmac-sha256:abcd...","event":"order.create","account_id":"acct_abc","source_ip":"10.0.0.5","user_agent":"certbot/2.9","decision":"allow","details":{"order_id":"ord_xyz"},"mac":"hmac-sha256:1234..."}
```

| Field | Always present | Description |
|---|---|---|
| `ts` | yes | RFC 3339 timestamp with millisecond precision, in UTC |
| `schema` | yes | Schema version string. Currently `"1"`. Bumped only on incompatible layout changes. |
| `seq` | yes | Strictly increasing per installation. Resumes across restarts and rotations. |
| `prev_mac` | yes | The `mac` of the previous line, prefixed with `hmac-sha256:`. The first line uses the **genesis MAC** anchored on the installation key. |
| `event` | yes | Dot-namespaced event name (`order.create`, `certificate.revoke`, …) |
| `account_id` | optional | ACME account identifier when the event is account-scoped |
| `source_ip` | optional | Client IP (see RGPD note below) |
| `user_agent` | optional | Client User-Agent string |
| `decision` | optional | `allow` or `deny` for events that involve a policy check |
| `reason` | optional | Human-readable reason — empty when not applicable |
| `details` | optional | Event-specific payload, encoded as a JSON object |
| `mac` | yes | `hmac-sha256:<hex>` of all preceding fields. Always the last field on the line. |

Optional fields are omitted from the line when empty (`omitempty`).

## How the Chain Works

On the very first install, Hortval generates a 32-byte random secret and stores it in the database (`audit_state` table). The secret is never logged, never exposed via any API, and never rotated.

The first line of every installation is anchored to a **genesis MAC** computed from the secret and the stable installation identifier:

```
genesis_mac = HMAC-SHA-256(secret, "certeasy-audit-v1|" + installation_key)
```

Each subsequent line carries the `mac` of the previous line in its `prev_mac` field, and computes its own `mac` as `HMAC-SHA-256(secret, line_bytes_without_mac)`. Tampering with any line invalidates that line's MAC; tampering with the chain (insertion, deletion, reordering) invalidates the next `prev_mac`.

The genesis anchor matters: an audit file restored on a different installation (different `installation_key`) will not validate, even if the secret matches. This is intentional — it prevents a stolen audit file from being passed off as evidence on another system.

### Why HMAC and not plain SHA-256

A plain hash chain seeded from a publicly known value (the installation key is visible in logs and the license portal) would let anyone with write access to the file rebuild the chain after modifying a line. HMAC requires the secret stored in the database — without DB access, the chain cannot be reforged.

The threat model: filesystem compromise alone does not allow forgery. DB compromise is a higher bar; if an attacker has read/write access to the database, the audit log is no longer the weakest link.

## Verifying the Chain

The chain is only useful if you actually verify it. Run:

```sh
hortval audit verify -f /etc/hortval/config.yml
```

The command walks every segment in write order, then the active one. It validates:

1. Each line's `mac` against `HMAC(secret, line_bytes_without_mac)`.
2. Each `prev_mac` against the previous line's `mac` (or the genesis MAC for line 1).
3. That `seq` is strictly increasing.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Chain valid (or no audit lines exist yet — fresh install) |
| `1` | Chain broken. The first break is reported on stderr with file, line number, and reason. |

You can override the file path:

```sh
hortval audit verify -f /etc/hortval/config.yml --path /backups/2026-05/audit.log
```

This still requires the database (the secret and the installation key live there), so the override is for verifying a copy of the file alongside the live DB — not for verifying a backup on a different machine. To verify a snapshot offline, restore the DB backup alongside the audit file first.

### When to verify

- **Periodically** (e.g. nightly via cron / Task Scheduler) — catch silent corruption early.
- **After every restore** — confirm the audit file and the database secret are consistent.
- **When investigating an incident** — confirm the timeline you are reading was not modified after the fact.

## Listing nodes that wrote to the chain

Each audit line carries the `server_id` of the node that wrote it (see [Node identity](./deployment-topology#node-identity)). To list every node that has ever booted against this database — useful when investigating who wrote which lines, or before decommissioning a host:

```sh
hortval audit list-servers -f /etc/hortval/config.yml
```

Output columns: `server_id`, `hostname`, `first_seen`, `last_seen` (UTC, RFC 3339). Sorted by `last_seen` descending so the most recently active node appears first.

## Storage and Backups

The HMAC secret lives in the database. **Backing up the database is required** for the audit log to remain verifiable: the audit file alone is useless without the secret. Cover both in the same backup procedure — see the [Backup](../administration/backup) page.

Loss of the secret means loss of verifiability for all earlier lines (the file is still readable, just no longer cryptographically anchored). New writes cannot resume the old chain; on a fresh install, the writer starts a new chain from a new genesis.

## Personal Data and RGPD

`source_ip` and `user_agent` are potential personal data. Retention and the user-facing notice are the responsibility of the operator who installs and runs Hortval:

- **Retention** — Hortval does not delete audit lines on its own. The retention policy is whatever your OS rotation rule keeps.
- **Notice** — Mention the audit log in your service's privacy notice.
- **Access controls** — The audit file is created with `0644` permissions by default. Restrict the directory if your hosting model requires it.

There is no PII redaction option in v1: the goal of the audit log is forensic, and redacted entries would defeat that goal. Operators who cannot retain IPs should disable the audit log entirely (`enabled: false`) and accept the loss of forensic capability.

## Operational Notes

- **Failures do not block business flow.** If a write to the audit file fails (full disk, permission error), the failure is logged via the `audit` log service and the operation continues. Audit gaps are detected by `audit verify`, not by ACME clients.
- **Line size cap.** Lines are capped at 1 MiB. Events that would produce a larger line are dropped with a log entry. The cap is a defence against a misbehaving event source — legitimate events are well below 1 KiB.
- **No auto-purge, by design.** Hortval never deletes an audit segment, whatever the configuration. Retention is entirely a function of your archival policy — copy closed segments to your long-term store and remove them there, never through a rotator pointed at the live directory. A duration-based retention setting is planned; until then, deleting evidence remains a deliberate operator action.
