---
sidebar_position: 1
title: Changelog
---

# Changelog

## v0.9.5 - unreleased

### Breaking changes

- **Certeasy is now Hortval, and so are the command and the binary.** Every
  invocation changes with it: the `ExecStart` of a systemd unit, the `binPath=` of
  a Windows service, and whatever your runbooks and monitoring call. Release
  artefacts are named `hortval-<version>-<os>-<arch>`.

  Nothing inside the ACME protocol carries the name, so **ACME clients are
  unaffected** — no account, order or certificate needs anything done to it, and
  no client configuration changes. The configuration file keeps its name and every
  one of its keys.
- **The default working directory moved. If your data is still in the old one,
  the server will not start.** The default is now `%ProgramData%\hortval` on
  Windows, `/var/lib/hortval` on Linux, `~/Library/Application Support/hortval`
  on macOS.

  This only concerns you if you never set `workdir` in your configuration —
  **an explicit `workdir` is used as written and nothing else is checked.**
  Otherwise, when the pre-rename directory still contains something, startup
  stops and offers three ways out: move that directory to the new location, keep
  it where it is by writing `workdir:` with its path, or delete it if it is a
  leftover.

  **Why stop instead of just using the old directory?** Because it would work —
  for a year or two. The old location disappears in v2, and an installation
  quietly living there would break then, with nobody left who remembers a
  warning from an upgrade long past. Stopping costs one decision, taken once,
  while someone is looking at a console.

  **And why not move the directory for you?** It holds the database, the node
  identity, the audit log and the CA key. Copying a database while opening it is
  not something a startup path should attempt, and a half-copy leaves two
  installations that both look right.
- **The working directory is no longer searched for `config.yml`.** Until now it
  came first, ahead of the executable's directory and `/etc`. That meant running
  `hortval audit verify` or `hortval backup create` from any directory a less
  privileged account could write to loaded *that* account's configuration file —
  and the configuration file selects the database, the working directory, the
  audit log destination and the outbound proxy. Pass `-f <path>` if you were
  relying on it. Everything the documentation describes already passes `-f`: the
  systemd unit, the `sc.exe create` line, and every command the setup wizard
  prints when it finishes.
- **Two or more candidate configuration files is now a startup error.** Certeasy
  used to take the first one found and ignore the rest, so a file in one
  searched directory silently shadowed the file in another — including
  `config.yml` shadowing `config.yaml` in the same directory. It now refuses to
  start, names every file it found, and asks for `-f`. No directory takes
  precedence over another; if you had two and were relying on the order, that
  order was never documented and never guaranteed.
- **A configuration file that exists but cannot be read is reported instead of
  skipped.** Certeasy cannot load it, so it is not a candidate — but falling
  back to another file without saying so would apply a configuration you did not
  intend. It is named, with the reason, either in the startup warning or in the
  "no readable configuration file found" message.

- **Every configuration setting that names a path must now be absolute or
  anchored**, and a relative one is refused at startup and by
  `hortval validate`. This covers `workdir`, `database.path`, `audit.path`,
  `logs.file`, `local-pki-cache-dir`, `letsencrypt.cache-dir`, and a bundle's
  `local-cert-file` / `local-key-file`. None of them was anchored: a relative
  value was resolved against the process working directory — which for a Windows
  service created with `sc.exe` is `C:\Windows\System32`, since `sc.exe` has no
  field to set it. A deployment could therefore end up with two working
  directories, and on Postgres or SQL Server the service started anyway with a
  fresh node identity, a fresh audit chain and a regenerated fake CA. Anchor
  with `%WORKDIR%`, or `%CONFIGDIR%` for `workdir` itself; a refusal names the
  setting, and when a live installation sits where the value resolves it prints
  the exact line to write.

  The documentation previously stated the opposite — that relative paths were
  resolved relative to `workdir`. That was wrong, and is corrected on
  [Configuration overview](/configuration/overview).

- **Two per-service log names changed, and an unrecognised one now stops
  startup.** `Certeasy-acme-server` became `acme-server`, `cert-easy-main`
  became `main` — they carried the product name. There is no alias: a
  configuration using an old name is refused, and the message lists the accepted
  ones.

  The refusal matters more than the rename. Until now an unrecognised key in
  `logs.services` was **silently ignored** — the level you asked for fell back to
  the global default and nothing said so, so the only symptom was logs quieter
  than expected, precisely when you were trying to diagnose something. The
  accepted names are listed on [Logging](/administration/logging), and that list
  is now exhaustive.

### Changes

- **`hortval validate` now checks the filesystem, and `--no-disk` skips it.** It
  looks at what it can — does a working directory's parent exist, is an
  installation already sitting where a path resolves — because the machine you
  validate on is usually the machine that will serve. Two things it deliberately
  does not do: it never writes anything, and it never checks writability. A
  filesystem failure it cannot attribute is reported as a **warning**, not a
  verdict, because `validate` runs as the account that typed it while the server
  runs as its service account — guessing another identity's permissions produces
  confident wrong answers.

- **The Windows binary is signed with Authenticode**, timestamped so the
  signature outlives the signing certificate. Verify with
  `Get-AuthenticodeSignature`; the signer is SAFE PIC TECHNOLOGIES. Note that
  **SmartScreen still appears** — what changes is that it now names the
  publisher instead of saying "Unknown publisher". Linux and macOS binaries
  remain covered by `SHA256SUMS` for integrity only. See [Verifying release
  binaries](/security/verifying-binaries).

- **New `%CONFIGDIR%` token, valid in `workdir`**, expanding to the directory
  holding the configuration file. It exists because `workdir` is the one path
  that could not use `%WORKDIR%` — it *is* the working directory. `hortval init`
  now proposes `%CONFIGDIR%/workdir` instead of `./workdir`, so a generated
  configuration means the same directory wherever it is later started from, and
  a free-form relative answer is written out already resolved.
- **Configuration is now looked for under `hortval` before `certeasy`** —
  `%PROGRAMDATA%\hortval` and `%APPDATA%\hortval` on Windows, `/etc/hortval` and
  `$XDG_CONFIG_HOME/hortval` on Linux. The `certeasy` directories are still read,
  with a warning naming both the old and the new location; they will be removed
  in v2. Nothing to do at upgrade time.
- **Machine-wide configuration directories are searched before per-user ones**,
  on every platform. Windows already did; Linux and macOS had the reverse order.
  Since two candidates are now refused outright this changes no outcome — it
  changes what the error message lists first, and the per-user directory is the
  one an unprivileged account can write to.
- **The licensing backend moved to `api.hortval.com`.** If your egress is
  filtered by hostname, allow it before upgrading — otherwise online licence
  checks fail and the deployment slides into its degraded states. Offline
  installations are unaffected.
- **A `letsencrypt` bundle now always serves an ECDSA P-256 certificate.**
  Previously the key type was decided by whichever client connected first, and
  then served to everyone: `autocert` indexes its cache by key type and holds
  both, but the certificate manager keeps one certificate per bundle, so the
  first handshake settled it for the life of the process. If a client of yours
  needs RSA, use `mode: pki` or `mode: files`, where `key.type` is yours to set.

### Upgrading from v0.9.4 — what changes for an existing configuration

Nothing to do if you pass `-f` and every path in your configuration is absolute.
Otherwise, find your case:

| Your v0.9.4 setup | v0.9.4 did | v0.9.5 does | What to do |
|---|---|---|---|
| `-f <path>` on the command line | loads it | same | nothing |
| No `-f`, `config.yml` in the **current directory** | loaded it | **refuses**, and lists where it looked | pass `-f`, or move the file |
| No `-f`, `config.yml` next to the binary | loaded it | same | nothing |
| No `-f`, `config.yml` in `/etc/certeasy` or `%PROGRAMDATA%\certeasy` | loaded it | loads it **and warns** | rename the directory to `hortval` before v2 |
| Two candidate files in two directories | loaded the first, ignored the other | **refuses**, names both | pass `-f`, or delete one |
| `config.yml` **and** `config.yaml` side by side | `.yml` won | **refuses**, names both | pass `-f`, or delete one |
| A config file that exists but cannot be read | was selected, then failed to open | **skipped**, and reported; another readable file is used with a warning | fix the permissions |
| `workdir: ./workdir` (or any relative path) | resolved against the working directory | **refuses**; if a live installation sits where it resolves, prints the exact line to write | use that line, or an absolute path, or `%CONFIGDIR%/…` |
| `workdir` not set, old directory holds data | `%ProgramData%\certeasy` / `/var/lib/certeasy` | **refuses**, and names the three ways out | move it, or name it with `workdir:`, or delete it if it is a leftover |
| `workdir` not set, nothing in the old directory | `%ProgramData%\certeasy` / `/var/lib/certeasy` | `%ProgramData%\hortval` / `/var/lib/hortval` | nothing |
| `workdir` set to an absolute path | resolved | same, and the rename check is skipped | nothing |
| `database.path: %WORKDIR%/db.sqlite` | resolved | same | nothing |
| `audit.path`, `logs.file`, `letsencrypt.cache-dir`, `local-cert-file`, `local-key-file` with `%WORKDIR%` | **taken literally** — created a directory actually named `%WORKDIR%` under the working directory | resolved | delete any stray `%WORKDIR%` directory once the real files are in place |
| `certreq-path` / `certutil-path` | resolved from the Windows system directory, relative refused | **unchanged** | nothing |

| `logs.services` naming a service | applied it | **refuses** an unrecognised name (they were silently ignored); `Certeasy-acme-server` → `acme-server`, `cert-easy-main` → `main` | rename the keys |

The wizard is affected too: `certeasy init` used to write `workdir: ./workdir`,
which v0.9.5 refuses. A configuration generated by v0.9.4's wizard therefore
needs its `workdir` line changed — the startup message tells you what to write.

See [Minimal configuration](/getting-started/minimal-configuration) for the full
search order, and [Configuration overview](/configuration/overview) for the
anchor tokens. If you are coming from a release older than v0.9.4, work through
[Upgrading](/upgrading) first — it collects everything that changed since v0.9.1.

### Rolling back to v0.9.4

**You can.** Nothing in this release prevents going back:

- A configuration fixed for v0.9.5 stays readable by v0.9.4, provided you used
  the absolute paths the startup message hands you. The `%CONFIGDIR%` token is
  new and v0.9.4 would take it literally — it only appears in configurations
  generated by `hortval init`, that is on fresh installs, which have nothing to
  roll back to.
- No schema migration ships in this release, so the database is unchanged.

Keep this in mind if you edit by hand: anchoring a path with a token that
v0.9.4 does not substitute is what would close the door. An absolute path never
does.

## v0.9.4 - 2026-08-04

We re-review the Certeasy codebase internally whenever materially more capable
code-analysis tooling becomes available. This release is the outcome of such a
review, run in July 2026 with the then-current generation of Claude and triaged
by hand. Every finding was assessed, and the ones that could affect a running
deployment are fixed here. Two breaking changes had to be introduced in the
product's configuration along the way; both are described below.

The review also recorded what was attacked and held. That part never appears in
a changelog, which is a shame, because it is what a security review is actually
for:

- **No finding permits private key compromise, customer data exfiltration, or
  remote code execution.**
- **CSR validation verifies the signature** rather than assuming proof of
  possession, and parses the request **twice** — once with the standard library,
  once with a strict hand-written ASN.1 pass — then compares the resulting SAN
  sets byte for byte, as a defence against parser differentials. Subject
  Alternative Names are restricted to `dNSName`: `otherName`/UPN, `rfc822Name`,
  URI and IP addresses are refused outright. This makes the ESC1/ESC6
  escalation vector **structurally impossible to request rather than filtered**
  — a distinction that matters on an ADCS deployment. It bounds what a client
  can ask for, not what your CA can issue; the template remains yours to
  harden. See [Certificate Security Model](/security/certificate-model).
- **JWS algorithm confusion has no landing point.** The verifier is selected on
  key type, each verifier re-reads the protected header and requires an exact
  algorithm with a matching curve, and there is **no HMAC verifier and no `none`
  verifier anywhere in the code** — so the classic "sign with HS256 using the
  public key as the secret" attack has nothing to reach.
- **No IDOR.** Every endpoint that takes an object identifier — account, order,
  finalize, authorization, challenge, certificate — compares the object's owning
  account against the authenticated one before returning anything. No handler
  fetches by identifier without that check. The single unscoped lookup in the
  codebase is reachable only on the certificate-key revocation path — which
  RFC 8555 §7.6 requires — and only after the embedded key has been matched byte
  for byte against the certificate's public key.
- **No SQL injection.** Every query is a compile-time constant with
  placeholders; there is no `LIKE` query anywhere in the repository and every
  `ORDER BY` is a literal.

A dedicated security page covering the threat model and host hardening is in
preparation.

### Security

This release resolves findings from an internal security review. Details of the
underlying mechanisms are deliberately omitted while deployments upgrade.

- **A specially crafted request could cause a denial of service** (remote,
  unauthenticated). Fixed. No data exposure and no authentication bypass.
- **Order identifiers are now canonicalised when the order is created**, and
  non-DNS identifier types are rejected explicitly. Previously an identifier was
  stored as submitted, so what was validated could differ from what was stored.
  This is a conformance fix (RFC 8555 §8.4) rather than an exploitable one:
  reaching the divergent case required write access to the DNS zone, which
  already allows obtaining the same certificate through the normal `dns-01`
  path. It is corrected because a stored value that diverges from the validated
  one is a hazard for future changes, not because it granted anything.
- **Valid requests could be rejected under normal operation.** A defect in the
  replay-protection bookkeeping refused nonces that were still valid. **Any
  deployment with two or more concurrent ACME clients was affected
  continuously**, without anyone attacking it — clients recovered by retrying as
  the protocol requires, so the symptom was extra round-trips and latency rather
  than visible failures. Single-client deployments were never affected.
- **Log and audit files are now owner-only** (`0600`, directories `0700`),
  matching the rest of the product. This matters as soon as `audit.path` points
  outside the working directory: the audit trail records account identifiers,
  source IPs, user agents and decisions. **On Windows this has no effect**:
  access there is governed by the NTFS permissions inherited from the containing
  folder — set that folder's ACL at install time. The mode bits apply on Linux
  and macOS.
- **Audit log rotation could destroy history.** A failed rotation — an antivirus
  holding the file, a full disk, a permissions problem — could discard a
  generation of history without archiving anything, and without reporting it.
  Rotation was rewritten: it now fails without touching existing files, reports
  the reason on stderr, and retries later. See *Breaking changes* for the
  consequence on file naming.
- Updated `golang.org/x/text` and `golang.org/x/crypto`.

### Rate limiting

Two changes here, and the second is new behaviour rather than a new setting.

- **The per-IP request ceiling now applies to every endpoint**, and is checked
  before any cryptographic work. Previously only four endpoints consulted it;
  the rest — including the polling a client does while waiting for validation —
  were unmetered. Because the ceiling now sees a client's full traffic, its
  defaults were raised accordingly: `requests-per-minute` from `200` to `1200`,
  `burst` from `20` to `100`. If you had tuned these values down, review them:
  issuing a single 3-name certificate costs at least 18 requests.
- **New `abuse` limiter, enabled by default.** It does not cap requests; it
  *marks* an IP that behaves in a way no conformant client does — a signature
  that does not verify, or an attempt on a resource belonging to another
  account. A marked IP is then refused on everything until it recovers, which
  takes about thirty seconds of good behaviour. Ten such events are tolerated
  first, so a client that slips once is unaffected.

  Marks are **weighted**. A request for an identifier that simply does not exist
  counts a quarter, because it has an innocent reading — a client returning to a
  URL whose resource has since been cleaned up gets the same answer as someone
  probing at random. Four such misses make one abuse, so occasional ones cost
  nothing while systematic probing still blocks. Routine outcomes count nothing
  at all, `badNonce` in particular: it happens to every client whenever the
  server restarts. See the configuration reference for the full table.

- **Account creation now allows a deployment wave.** `account-creation` moves
  from `5`/hour with a burst of `2` to `10`/hour with a burst of `10`. Creating
  an account is a once-per-machine-for-life event, so legitimate traffic arrives
  in bursts when you provision, not at a steady rate — and a burst smaller than
  the hourly allowance refused the third machine of a batch deployed behind a
  single NAT address. The sustained ceiling, which is what actually bounds
  abuse, only doubles.

If your clients reach Certeasy through a reverse proxy, set `trusted-proxies` in
the `server` section so the limiters see real client addresses. Whitelisting the
proxy would exempt every client behind it.

### Schema and migrations

A restart is rarely something a human decided — a crash, a reboot, a service
manager or a failed health check all restart the process, and none of them is a
moment when someone is standing by with a backup. Certeasy now applies on its own
only what doing nothing could have survived.

- **A restart applies additive migrations only.** Anything that cannot be undone
  by rolling the binary back stops startup and names what is pending. Nothing
  changes today for an existing deployment: every migration currently shipped is
  additive.
- **New command `certeasy migrate`**, with `--confirm` to acknowledge a backup and
  `--sql` to write the statements instead of running them.
- **New setting `database.noddl`** for accounts that hold no schema rights.
- **A database newer than the binary, or left mid-upgrade, is refused** rather
  than started on.

See [Migrations](/administration/migrations) for the full contract, the exit
codes and the `noddl` workflow.

### Breaking changes

- **The `adcs-cli` connector takes `certreq.exe` and `certutil.exe` from the
  Windows system directory** (typically `C:\Windows\System32`) instead of
  looking them up through `%PATH%`. An unset key, or a bare file name with or
  without the `.exe` extension, resolves there — existing configurations keep
  working. Set a full path to run a copy kept elsewhere, for instance on a path
  carved out of an EDR policy. A path relative to the working directory
  (`tools\certutil.exe`) is now refused at startup and by `certeasy validate`.
  The native connector is unaffected: it runs in-process over COM and starts no
  external binary.
- **ADCS `ca-name` and `certificate-template` are refused when they contain a
  control character or a colon, or start with a dash.** Those characters
  delimit fields in the request sent to the CA, so a value carrying one changes
  the request rather than naming it. Ordinary names — `PKI01\Lab-Issuing-CA`,
  `Web Server v2` — are unaffected.
- **A `dns-validation-profiles` entry with neither `allow-cidrs` nor
  `deny-cidrs` is refused at startup**, and by `certeasy validate`. An empty
  `resolved-ip-policy` accepted every address DNS returned — link-local and cloud
  metadata (`169.254.169.254`) included. Unset is not the same as deliberately
  open, so it is refused instead of defaulted. Add the networks your targets live
  on, or `allow-cidrs: ["0.0.0.0/0", "::/0"]` if you accept any address on
  purpose. This applies to every profile whatever challenge you use: challenge
  types cannot be restricted per profile, so a profile that has only ever seen
  `dns-01` still offers the paths this policy guards. Configurations produced by
  `certeasy init`, and the shipped examples, already carry the block.
- **A `fake` authority with no `common-name`, no `password`, a `key-size` below
  2048 or a non-positive `validity` is refused at startup**, and by
  `certeasy validate`. That driver parsed its configuration without checking any
  field, so these were accepted and then failed later — after the database had
  been migrated — or produced a CA that expired the second it was created.

- **`audit.rotate.max-backups` no longer exists and a configuration containing
  it is refused at startup.** The audit log is a compliance artifact: deleting it
  by file count is not a setting. Remove the key from your configuration before
  upgrading. Retention will return as a *duration*, which is the unit a
  compliance requirement is actually written in.
- **External rotation of the audit file (logrotate, Scheduled Task) is no longer
  supported.** A third party renaming or truncating the file breaks the
  tamper-evident chain, and Certeasy cannot distinguish that from tampering.
  Certeasy segments the file itself; remove any logrotate rule targeting
  `audit.path`. Earlier documentation recommended `copytruncate` here — that
  recommendation was wrong and is withdrawn.
- **With rotation enabled, `logs.file` and `audit.path` are naming bases, not
  files.** Segments are written beside them as
  `<name>.<UTC timestamp>.<discriminant>.<ext>` — for example
  `certeasy.20260726T091702Z.ms123.log` — and are **never renamed**. Configure log
  collectors with the containing folder and a `*.log` pattern rather than the
  path in `file`; following the live file interactively now means picking the
  newest segment.
  This also means existing `logrotate` rules on `logs.file` become inert.
  Rationale: a rotation now creates exactly one file and mutates nothing else,
  and a closed segment is immutable — which is what makes archival, and the
  audit chain, safe. It also removes a long-standing annoyance for log
  collectors, which previously saw duplicate or missing lines at every rotation.

### Fixes

- **On a shared database, Certeasy could build its schema in the wrong place.**
  Where a table of the same name already existed in another schema — a `jobs` or
  a `servers` belonging to a different application — Certeasy could take it for
  its own and then read and write that application's data. SQL Server
  deployments using a schema other than `dbo` were affected. Certeasy no longer
  asks the question that made this possible.
- **The schema in use is reported at every start**, and any of Certeasy's tables
  found outside it are named. Two instances sharing a database *and* a schema
  share their data — a valid multi-node deployment, and an accident that looks
  identical from the database's side. See
  [Migrations](/administration/migrations).

### Documentation

- **The migrations page was rewritten** — it described a schema silently brought
  up to date at every start, with nothing ever to run by hand. Neither is true
  any more.
- The database configuration page gained the `noddl` setting and a section on
  schema selection.
- The rate-limiting page described the whitelist incorrectly: it stated that
  `order-creation` still applied to a whitelisted IP. It does not — a whitelisted
  IP also bypasses that limiter. The behaviour is unchanged; only the
  documentation was wrong. The limits that remain in force for a whitelisted IP
  are the account-scoped ones: `duplicate-certificate`, `failed-validation` and
  `pending-authorizations`.

### Improvements

- **Security controls that are switched off are now announced at startup.**
  Disabling the audit log or a rate limiter is a legitimate choice; doing it
  without a trace is not. Certeasy logs one warning per disabled control, naming
  the setting and its consequence. A default configuration stays silent — a
  warning that fires on a healthy install is noise.

---

## v0.9.3 - 2026-07-09

### New features

- **ADCS certificate revocation**: ACME revocations now propagate to the backing Microsoft ADCS CA (CRL / OCSP), not just Certeasy's own database. RFC 8555 §7.6 authorization is supported with both the account key (`kid`) and the certificate key (`jwk`). Propagation can be turned off per authority with `disable-ca-revocation: true` (for service accounts without the required CA role, or air-gapped deployments). Note: revoking on the CA needs the **Certificate Manager** role — a higher privilege than enrollment.
- **`certeasy adcs check`** — a read-only preflight for ADCS authorities: checks that the CA is reachable, that the certificate template is published, and reports the template's key requirement. Use it to diagnose ADCS setup before starting the server (or to hand support a clear status).
- **Configurable server-certificate key**: a `pki`-mode bundle in the TLS certificate manager now accepts an explicit `key:` — `type: rsa` with `size:` (bits), or `type: ecdsa` with `curve:` (`P-256`/`P-384`/`P-521`). Set it when the CA template mandates a specific key. In particular, an ADCS template that requires **RSA 4096** previously rejected Certeasy's default ECDSA key and prevented startup; setting `key.type: rsa` with `key.size: 4096` resolves it. The default is unchanged (ECDSA P-256).

### Improvements

- **`certeasy init` — ADCS onboarding**: the wizard now defaults to ADCS, lists the CA's published certificate templates so you select the exact one (no typos, only published templates), and reads the template's key requirement to set the server-certificate key automatically — falling back to asking you when the template cannot be read.
- **Clearer ADCS denial messages**: when the CA denies a request, Certeasy now surfaces the actual reason (for example, "the public key does not meet the template's key size requirement", `CERTSRV_E_KEY_LENGTH`) with an actionable hint, instead of an opaque `CR_DISP_DENIED`. The diagnosis is keyed on the CA's error code, so it stays accurate regardless of the CA's display language.

### Security

- Updated the Go toolchain to **1.26.5** to address **GO-2026-5856** (an Encrypted Client Hello privacy leak in the standard library's `crypto/tls`).

---

## v0.9.2 - 2026-06-17

### New features

- **Native ADCS connector** (now the default for `type: adcs`): Certeasy enrolls against ADCS **in-process**, without launching `certreq.exe`. This removes the child-process (LOLBin) signature that strict EDRs flag, making Certeasy eligible for more hardened deployment perimeters. Existing `type: adcs` configurations switch to it automatically on upgrade — no change required.
- **`certeasy validate`** — a configuration check in the spirit of `nginx -t`. `certeasy validate -f <config>` parses and validates a configuration statically, with no side effects (no database, no network, no file writes). `serve` now runs the same validation as a fail-fast boot gate, so an invalid configuration is rejected before startup instead of failing halfway through.

### Improvements

- `certeasy init` now lets you choose the ADCS connector (native in-process, or `certreq.exe`) when generating a configuration.

### Changes

- The `certreq.exe`-based integration remains available as an opt-in fallback under `type: adcs-cli`.
- The unused `cert-util-timeout` ADCS option is no longer documented; it is still accepted in existing configurations but has no effect.
- **ADCS request timeout**: `default-timeout` now defaults to **4 minutes** and is honored as configured. Previously a legacy behavior capped the effective ADCS wait at **30 seconds** regardless of `default-timeout`; that cap is removed. Keep `default-timeout` below `workers.max-job-duration` (default 5m) — Certeasy warns at startup if it is greater than or equal.

### Fixes

- `certeasy init` generated an ADCS authority block with incorrect field names; it now emits the correct `ca-name` / `certificate-template` schema.
- **SQL Server backends**: upgraded the SQL Server driver to go-mssqldb v1.10.0, which improves connection handling when a query is cancelled or times out. Recommended for all SQL Server deployments.
- **DNS validation profiles**: the zone `protocol` field (`udp` / `tcp`) is now honored. It was previously parsed but ignored (DNS lookups were always UDP-first with a TCP fallback); set `protocol: tcp` to force DNS validation over TCP on networks where UDP/53 is unavailable.

---

## v0.9.1 - 2026-06-10

### New features

- `certeasy init` command — interactive (and scriptable) wizard to generate a `config.yml`.
- Database connection: new `conn-max-lifetime` and `conn-max-idle-time` options.

### Improvements

- Readable text output for one-shot subcommands (`license`, `backup`, `audit`, `cold-start`). The `serve` daemon keeps its structured JSON output.
- All displayed and logged dates are in UTC.
- Richer startup banner: installation ID and license ID.

### Changes

- The `--grace` and `--cold-start-plan` flags are removed. The boot mode (valid license, post-expiration, cold-start, refusal) is now determined automatically from persistent state.
- License registration is validated by the portal; a portal refusal is surfaced verbatim to the operator.
- A license retired by the portal enters a grace window before boot is refused.

### Fixes

- Shutdown stability: removed a possible SQLite panic and a goroutine leak on the ACME rate limiter.

---

## v0.9.0 - 2026-05-31

Initial public release.

### Features

- ACME server (RFC 8555) covering account registration with key rollover, orders, authorizations, challenge validation, finalization, certificate retrieval, and revocation
- HTTP-01, DNS-01 and TLS-ALPN-01 challenge validation
- Wildcard certificates, including mixed `[apex, *.apex]` orders (RFC 8555 §7.1.4)
- ACME Renewal Information endpoint (RFC 9773, read-only) for client-driven renewal scheduling
- ADCS authority via `certreq.exe`
- Built-in fake PKI authority for local testing
- Issuance policies with DNS scope rules and signature constraints
- Policy bindings with `first_available` and `round_robin` strategies
- Server-side rate limiting per ACME account (duplicate-certificate)
- SQLite (default), PostgreSQL and SQL Server backends
- Async job engine with persistent retry and exponential backoff
- TLS certificate manager for the server's own certificate (`files` and `pki` modes)
- Structured logging with per-service level overrides and log rotation
- Tamper-evident ACME audit log (JSONL + HMAC chain, validated by the `audit verify` command)
- SQLite backup CLI (`backup create` / `backup verify`)
- License enforcement with strict boot and acknowledgement of degraded states
- Graceful HTTP shutdown
- Built-in mitigations against ESC-class attacks: DNS-only identity, Server Authentication EKU only by default

### Interoperability covered by automated tests

- ACME clients: certbot, lego, acme.sh, and a built-in protocol client
- Backends: ADCS, fake PKI
- Databases: SQLite, PostgreSQL, SQL Server
- Full clients × challenges × databases × backends matrix

---

:::note
Certeasy v0.9.x is a **stable release**, used for day-to-day issuance, renewal and revocation. The full **production-ready** label is reserved for the upcoming **v1.0**, which closes the known, non-blocking limitations below:

- **Certeasy cannot be started as a Windows service with `sc.exe`.** The Service Control Manager handshake is not implemented, so `sc.exe start` fails with error 1053 and the process is killed after about thirty seconds, leaving the shutdown drain unfinished. Run it in a console, or under a wrapper that performs the handshake. Planned for v1.0. See [Installation](../getting-started/installation.md).
- **Some startup log lines only reach stderr, never `logs.file`.** The file receives everything the audit, PKI, HTTP, license and worker services emit, but a few lines from the main service are written before the configured destination is installed. A *refused* startup writes nothing to the file at all. Under systemd those lines land in journald; under the Windows SCM they are lost. Planned for v1.0. See [Logging](../administration/logging.md).
- **No health or metrics HTTP endpoints yet.** Operational monitoring is limited to log scraping and database introspection for now; dedicated `/health` and metrics endpoints are planned for v1.0.
- **No automatic data retention or cleanup.** ACME tables (orders, authorizations, challenges, …) grow without bound. Operators running long-lived deployments should plan for manual maintenance until automated retention ships in v1.0.
- **RFC 9773 `replaces` field is accepted but not yet honored.** Clients can supply `replaces` on new orders without error, but the linkage to the previous certificate is not applied. The `renewalInfo` endpoint itself is fully functional; full `replaces` semantics are planned for v1.1.
- **External Account Binding (EAB)** is not supported and is not planned for v1.0. Single-tenant enterprise deployments do not need it; see the [roadmap](../intro/roadmap.md) for v2.0 timing.
- **Caddy** interoperability has not been formally validated in this release.
:::
