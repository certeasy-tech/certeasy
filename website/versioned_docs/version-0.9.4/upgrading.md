---
sidebar_position: 1
title: Upgrading
---

# Upgrading from an earlier 0.9.x

This page lists every configuration change between **v0.9.1** and **v0.9.4** that
requires you to edit your `config.yml`, and the ones that change behaviour without
saying so. Read it before replacing the binary.

Two things make an upgrade here different from most:

- **The configuration file carries no version number, and Certeasy never rewrites
  it.** There is no migration step and no compatibility shim. A key that no longer
  exists is not ignored — the file fails to parse and the server does not start.
- **The break is symmetric.** A configuration written for 0.9.4 also fails to load
  on a 0.9.3 binary. Rolling the binary back means restoring the old configuration
  file with it, so keep a copy.

## Check before you switch

The new binary can inspect your existing configuration without touching your
deployment. Download it, put it somewhere temporary, and point it at the
configuration the running service uses:

```bash
./certeasy-v0.9.4-linux-amd64 validate -f /etc/certeasy/config.yml
```

`validate` refuses exactly what `serve` refuses — that parity is guaranteed and
tested as of 0.9.4 — so a clean run means the file will load. Nothing is written,
no database is touched, and the running service is unaffected.

Work through whatever it reports, then swap the binary.

:::note Coming from 0.9.1
`validate` was introduced in 0.9.2, so your *installed* binary does not have it.
Use the new one as shown above — that is the point of the check.
:::

## Configurations that no longer load

Each of these stops startup. `validate` reports them all.

### Remove `audit.rotate.max-backups`

The key no longer exists, and a file still containing it is refused. Deleting an
audit log by file count is not a setting: the log is a compliance artifact and the
chain that makes it tamper-evident cannot survive an eviction. Retention will
return measured in **duration**, which is the unit a compliance requirement is
written in.

```yaml
audit:
  rotate:
    max-size-mb: 100
    max-backups: 10     # delete this line
```

This is the only configuration key ever removed.

### Give every DNS validation profile a `resolved-ip-policy`

A profile with neither `allow-cidrs` nor `deny-cidrs` is refused. An empty policy
accepted every address DNS returned, link-local and cloud metadata
(`169.254.169.254`) included. Unset is not the same as deliberately open, so it is
refused rather than defaulted.

```yaml
dns-validation-profiles:
  - name: internal
    resolved-ip-policy:
      allow-cidrs:
        - "10.0.0.0/8"
        - "192.168.0.0/16"
```

Use `allow-cidrs` with `0.0.0.0/0` and `::/0` if you accept any address on purpose.

This applies to **every** profile whatever challenge you use — challenge types are
not restricted per profile, so a profile that has only ever served `dns-01` still
offers the paths this policy guards. Configurations produced by `certeasy init`,
and the shipped examples, already carry the block.

### Complete any `fake` authority

That driver used to parse its configuration without checking a single field, so
bad values were accepted and failed later — after the database had been migrated —
or produced a CA that expired the moment it was created. Now refused: an empty
`common-name`, an empty `password`, a `key-size` below 2048, or a non-positive
`validity`.

`key-size` must also be at least as strong as the strongest `min-rsa-bits` among
the issuance policies bound to that authority. A CA weaker than the certificates
it signs is a contradiction the server no longer accepts.

### Remove explicit zeros

A `0` written deliberately used to mean "no limit" in places where it silently
disabled a protection. It is now refused, and you get the default by omitting the
key instead.

| Section | Keys |
|---|---|
| `server` | `read-header-timeout`, `read-timeout`, `write-timeout`, `idle-timeout`, `shutdown-timeout`, `max-body-bytes` |
| `rate-limiting` | any quota under a section left `enabled: true` |
| `renewal-info` | `window-width`, `retry-after` |

`renewal-info.lifetime-fraction` must additionally sit strictly between 0 and 1.
Out-of-range values used to be clamped to two thirds without a word.

The `server` timeouts are worth a special look: before 0.9.4 their defaults were
computed into a copy that was then discarded, so a deployment that never set them
ran with **no deadlines at all**. Setting them correctly now is not a regression,
it is the first time the setting takes effect.

### Fix values that were never validated

| Key | Now required to be |
|---|---|
| `logs.output` | `stderr`, `stdout` or `file` — and `file` requires `logs.file` |
| `license.proxy-url` | a parseable `http`/`https` URL with a host |
| `license.timeout` | non-negative |
| `database.driver` | a driver that exists |
| `authorities[].configuration.ca-name`, `.certificate-template` | free of control characters and colons, not starting with a dash |
| `authorities[].configuration.certreq-path`, `.certutil-path` | absolute, or a bare file name |

Most of these were caught eventually — at the first online licence check, or after
the working directory and node marker had already been created. They are now
caught before anything happens.

For the ADCS binaries, a bare name such as `certutil.exe` resolves from the Windows
system directory and keeps working. A path relative to the working directory
(`tools\certutil.exe`) is refused. See
[ADCS authorities](./configuration/authorities.md).

## Changes that do not stop startup

These load fine and behave differently. They are the ones worth reading twice.

### Sections you filled in partially now work

Before 0.9.4, a configuration section was parsed into an empty structure, so
writing *part* of a section set everything you did not mention to zero:

- `audit:` with only `path:` meant `enabled: false` — **the audit log was off**
- `rate-limiting:` with only `whitelist:` meant every quota was zero — **every
  limiter was off**
- `database:` omitted entirely meant a nil configuration, which failed a cold start

Defaults are now applied first and your values written over them. If you were
affected, the upgrade turns these protections **back on**, and that is a change in
behaviour on your deployment even though you edited nothing. Check whether your
audit volume and your rate limits are what you intended.

### Rate limit ceilings see more traffic

The per-IP ceiling now applies to every endpoint rather than four of them, so its
defaults were raised to match: `requests-per-minute` from 200 to 1200, `burst` from
20 to 100. **If you tuned these values down, revisit them** — they now meter a much
larger population of requests, and a single 3-name certificate costs at least 18.

`account-creation` moves from 5/hour burst 2 to 10/hour burst 10.

### Log and audit files became naming bases

With rotation enabled, `logs.file` and `audit.path` name a *series*, not a file.
Segments are written beside them as `<name>.<UTC timestamp>.<discriminant>.<ext>`
and are never renamed.

Two consequences:

- **Point log collectors at the containing folder with a `*.log` pattern**, not at
  the path in `file`. Existing `logrotate` rules on `logs.file` become inert.
- **Remove any `logrotate` rule targeting `audit.path`.** External rotation of the
  audit file is no longer supported at all: a third party renaming or truncating it
  breaks the tamper-evident chain, and Certeasy cannot tell that apart from
  tampering. Earlier documentation recommended `copytruncate` here; that
  recommendation was wrong and is withdrawn.

While you are editing these two keys, write them as **absolute paths**. A relative
one resolves against the process working directory, not against `workdir` — this
page's predecessor claimed otherwise. See
[Configuration overview](./configuration/overview.md) for what that costs on a Windows
service.

`logs.rotate.max-backups` also changed default from `0` to `5`. At `0` — the old
default — enabling rotation discarded history at every turn.

### Your ADCS connector may have changed underneath you

From 0.9.2, `type: adcs` means the **native** connector: in-process COM, no
`certreq.exe`, no child process. Configurations naming `adcs` were switched over
without a word at upgrade time.

If you need the old behaviour — an EDR policy that only trusts the signed Microsoft
binaries, for instance — say so explicitly:

```yaml
authorities:
  - name: corp-ca
    type: adcs-cli      # was the meaning of `adcs` before 0.9.2
```

`adcs-native` is available as an explicit spelling of the new default. See
[Antivirus and EDR](./administration/antivirus-edr.md) for which one suits your host.

In the same release, `default-timeout` started being honoured. A bug meant it was
overwritten with 30 seconds whenever `cert-util-timeout` was unset, which was the
normal case; requests that used to be cut off at 30 seconds now run to the
configured value, or to the 4-minute default.

## What changed in which release

| | 0.9.1 → 0.9.2 | 0.9.2 → 0.9.3 | 0.9.3 → 0.9.4 |
|---|---|---|---|
| Keys removed | — | — | `audit.rotate.max-backups` |
| Values now refused | zone `protocol` | — | 11 groups, see above |
| Behaviour changed | `adcs` connector, `default-timeout` | — | partial sections, rate limits, rotation |
| Keys added | — | 7, all optional | 5, all optional |

**0.9.2 → 0.9.3 requires no configuration change.** It only added optional keys:
`disable-ca-revocation`, the certificate manager's `key` block, and a fake
authority's `certificate-validity`.

The one break in 0.9.2 is `dns-validation-profiles[].zones[].protocol`: a value
other than `udp`, `tcp` or empty was parsed and then ignored, and is now refused.
Note also that `tcp` came to mean TCP with **no UDP fallback**, where before the
setting did nothing at all.

## After the upgrade

Certeasy applies additive database migrations on its own at startup and refuses
anything that a rollback could not undo, naming what is pending. Nothing in the
0.9.1 → 0.9.4 range is affected — every migration shipped so far is additive — but
the contract, the exit codes and the `noddl` workflow are described in
[Migrations](./administration/migrations.md).

For the full narrative of each release, see the [Changelog](./changelog/index.md).
