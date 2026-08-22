---
sidebar_position: 2
title: Quick start with the wizard
---

# Quick start with the wizard

`hortval init` is the recommended way to get a working configuration in
a few minutes. It walks you through a handful of questions — what to listen
on, which database, which authority, which DNS zones you'll be issuing
certificates for, how the server's own TLS cert should be obtained — and
writes a valid `config.yml` you can `serve` immediately.

It's not a black box: every prompt shows you a sensible default in brackets and
explains what the field does. With an ADCS authority it runs a quick, read-only
check against your CA (is it reachable, is the template published, what key does
it require); in `--script` mode it stays fully offline.

## Run it

After [installing the binary](installation.md), from the work directory:

```bash
hortval init
```

That's it. By default it writes to `./config.yml`. Use `-o <path>` to put
it elsewhere, or `--force` to overwrite an existing file.

## What it asks

The flow is roughly:

| Section | What you decide |
|---|---|
| **Network** | Listen address, public URL(s) as seen by your ACME clients |
| **Database** | sqlite (default, Free and up) / postgres / sqlserver (Pro and Enterprise only). Connection details are turned into the right DSN. On PostgreSQL it also asks for the **schema** — leave it empty for the server default. On SQL Server it asks **how to authenticate**: as the Windows service account (integrated, no secret in the file) or with SQL credentials. It then offers to **test the connection**, and reports who the server saw you as. |
| **Workdir** | Where the runtime files live |
| **Authority** | `adcs` (Microsoft ADCS — the default) or `fake` (built-in lab PKI — generates its own root). For ADCS it asks for the CA name and template, **lists the CA's published templates so you pick the exact one** (no typos), and reads the template's key requirement to set the server certificate key for you. |
| **DNS zones** | One zone at a time: zone name, maximum subdomain depth (with worked examples), wildcard policy. Add as many zones as you need. |
| **clientAuth EKU** | Opt-in relaxation needed only if you plan to use `acme.sh` (which emits CSRs with an extra `clientAuth` EKU). Off by default. |
| **Server's own TLS** | Issue from the authority above (`pki`), Let's Encrypt automatically, or supply your own files. With an ADCS authority the key type (RSA size / ECDSA curve) is set to match what the template requires. |
| **Plan sizing** | Three quick questions (how many authorities, how many client servers, which DB). **Every answer names the smallest plan that allows it**, so the suggestion is never a surprise — and the wizard offers to open the cold-start window on the spot. |

:::caution The `${...}` password placeholder is not expanded
Leaving the password blank writes `${POSTGRES_PASSWORD}` or
`${SQLSERVER_PASSWORD}` into the DSN. **Hortval does not read environment
variables**: the placeholder is a marker for you, or for a tool like `envsubst`.

Replace it with the value, or expand the file before starting:

```bash
envsubst < config.yml > config.final.yml
```

`hortval validate` refuses a configuration whose DSN still carries one, so an
unfinished file fails with a message that says so — rather than reaching the
database and coming back as an authentication error.
:::

## What it generates

A YAML file equivalent to `config-minimal.yml` plus the choices you made:

- `server.listen` + `server.url`
- `database.driver` (+ `path` or `dsn` depending on the driver)
- `workdir`
- `tls-certificate-manager.bundles[0]` (auto-filled hosts list from the public URL)
- `dns-validation-profiles[0]` with each zone you declared
- `authorities[0]` (fully configured, `fake` or `adcs`)
- `issuance-policies[0]` with the depth/wildcard rules you chose, plus an
  explicit `=<public_host>` allow so the server can always issue its own cert
- `policy-bindings` written explicitly so the relationship is obvious

## What's next

After the configuration step the wizard asks how you want to start the
server:

1. **Open a cold-start window** — for evaluation / first run. It calls
   [`cold-start init`](license.md#option-3--cold-start-without-a-license-yet)
   with the suggested plan.
2. **Install a `.lic` file** — if you already have one. Equivalent to
   [`license install`](license.md#option-2--manual-file-import).
3. **Register a CRT-... key online** — equivalent to
   [`license register`](license.md#option-1--online-registration). You'll
   be asked for the deployment environment (prod, dev, staging, uat).
4. **Skip** — prints the commands you can run later.

Whichever branch you pick, the wizard prints the final commands you need
(typically `hortval serve`) and exits.

## Replay a session

```bash
hortval init --save-script /tmp/answers.txt
```

writes every answer you typed to a small text file. To regenerate the same
configuration on another machine — or to keep a reproducible setup recipe in
your git repo — feed it back to the wizard via stdin:

```bash
hortval init --script -o config.yml < /tmp/answers.txt
```

It's the same answers, same defaults, same output — no interactive prompts.
Useful when you want a teammate to apply the exact same setup, or to keep a
record of what was chosen on a server you no longer own.

## When to use the wizard vs. write YAML by hand

The wizard covers the common cases: one authority, a few DNS zones, a
straightforward TLS bundle, sqlite or a basic postgres/SQL Server.

If your deployment is more exotic — multiple authorities with bindings,
several DNS validation profiles, fine-tuned rate limits, a custom audit log
location — start from the wizard's output and edit by hand from there. The
[Minimal configuration](minimal-configuration.md) and reference pages cover
every field.
