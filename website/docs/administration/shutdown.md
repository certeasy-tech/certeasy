---
sidebar_position: 5
title: Graceful shutdown
---

# Graceful shutdown

Hortval stops cleanly on `SIGTERM` (Linux) and on the equivalent stop signal
sent by the Windows Service Control Manager. This page describes the behaviour
you can rely on, the two timeouts that bound it, and how to tune them.

## What happens on stop signal

- The HTTP listener stops accepting new connections.
- In-flight HTTP requests are allowed to finish.
- Async work already claimed by the jobs engine (challenge validation,
  PKI polling, ADCS calls) is allowed to finish so its result is persisted.
- The audit log and the database stay open for the full drain so late writes
  are never lost.
- Once the drain is complete, the process exits.

If a handler or a job is still running when the timeouts below expire, the
process exits anyway and that work is interrupted. Jobs that were running at
that point are picked up on the next start (the jobs queue is durable).

## The two timeouts

| Setting | Default | What it bounds |
|---|---|---|
| `server.shutdown-timeout` | `30s` | How long Hortval waits for in-flight HTTP requests to finish before forcing the listener to close. |
| `workers.drain-timeout` | `30s` | How long Hortval waits for in-flight async jobs to finish before forcing them to stop. |

### Invariant

`server.shutdown-timeout` must be **less than or equal to**
`workers.drain-timeout`. Hortval refuses to start otherwise:

```
server.shutdown-timeout (45s) must be ≤ workers.drain-timeout (30s):
in-flight HTTP handlers can enqueue jobs after the engine has stopped
draining
```

If HTTP outlasts the jobs engine, late requests can produce jobs that nobody
runs until the next start. Keeping the HTTP timeout at most equal to the jobs
timeout closes that window. The defaults (`30s` / `30s`) already satisfy this.

## Configuration

```yaml
server:
  url:
    - https://acme.example.com
  listen: 0.0.0.0:8443
  shutdown-timeout: 30s

workers:
  workers: 16
  drain-timeout: 30s
```

Both fields accept Go duration syntax (`s`, `m`, `h`).

## Tuning

- **Slow PKI backend (ADCS enrollment latency).** Raise both timeouts
  together (e.g. `60s` / `60s`) so a final issuance has time to complete
  before the engine is forced down.
- **Fast rotation, ephemeral instances.** The defaults are appropriate; don't
  lower them below `10s` or you will routinely interrupt healthy work.
- **Stay below your service supervisor's own stop timeout.** Both systemd
  (`TimeoutStopSec`, default `90s`) and the Windows Service Control Manager
  send a hard kill after their own deadline. Keep `shutdown-timeout` and
  `drain-timeout` comfortably below it.

## In-flight ACME requests

A long ACME operation (challenge validation, PKI poll) is allowed to keep
running for the full `shutdown-timeout`. This is intentional — interrupting
mid-request would leave the order in an awkward state for the client. If you
need a hard ceiling on individual request duration, use `server.write-timeout`
(default `30s`).

## After a restart

Run `hortval audit verify` if the audit log is enabled. The audit chain is
designed to resume cleanly across stop/start, but `verify` confirms that no
gap was introduced and reports the first break otherwise.

Jobs that were still running when the previous instance stopped are picked up
automatically once their lease expires (default `30s`). Nothing manual is
required.
