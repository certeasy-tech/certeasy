---
sidebar_position: 9
title: Workers
---

# Workers

The `workers` section configures the **async job engine** that runs challenge validation and certificate issuance in the background.

## Configuration

```yaml
workers:
  worker-id: "worker-1"
  workers: 16
  lease: 30s
  idle-min: 50ms
  idle-max: 200ms
  base-backoff: 1s
  max-backoff: 2m
  queue-size: 16
  drain-timeout: 30s
  max-job-duration: 5m
```

## Fields

| Field | Default | Description |
|---|---|---|
| `worker-id` | `worker` | Unique identifier for this worker instance. Useful in multi-node deployments. |
| `workers` | `16` | Number of concurrent worker goroutines. Goroutines are essentially free in Go (~2 KB stack each), so the default is generous; raise it further only if you observe the queue backed up. |
| `lease` | `30s` | How long a worker holds a job lock. If processing takes longer, the lease is renewed automatically. |
| `idle-min` | `50ms` | Minimum polling interval when the queue is empty. |
| `idle-max` | `200ms` | Maximum polling interval when the queue is empty. Caps the empty-queue exponential backoff so the first job that arrives after a long quiet period is picked up within this delay. |
| `base-backoff` | `1s` | Initial backoff on job failure. |
| `max-backoff` | `2m` | Maximum backoff after repeated failures. |
| `queue-size` | value of `workers` | In-memory job queue buffer size. |
| `drain-timeout` | `30s` | Maximum graceful-stop wait time for in-flight jobs before forced worker cancellation. Must be ≥ `server.shutdown-timeout`. See [Graceful shutdown](../administration/shutdown.md). |
| `max-job-duration` | `lease × 10` (i.e. `5m` at default lease) | Hard cap on a single handler invocation (one `Submit` or one `Check`, **not** the total job lifetime — polling jobs run their handler many times). When it elapses, the handler's context is cancelled (the deadline propagates through every ctx-aware network/command call), the heartbeat stops renewing the lease, and the job is requeued or failed depending on `max-attempts`. It is a wedge-recovery backstop for a handler stuck on a dead socket or deadlocked syscall, **not** a per-job SLA — keep it well above the longest legitimate invocation. Must exceed `lease`. Set to a negative value to disable. |

## How the Job Engine Works

All background work in Hortval (DNS challenge validation, ADCS polling) is handled by the job engine:

1. An ACME handler enqueues a job in the database
2. A worker picks up the job and acquires a lease
3. The worker executes the job handler (validate DNS, poll ADCS…)
4. On success, the job is marked complete
5. On transient failure, the job is rescheduled with exponential backoff
6. On fatal failure, the job is failed and the associated order is invalidated

Jobs are persistent — if Hortval restarts mid-processing, workers resume from the database.

## Shutdown and Recovery

- On **graceful stop** (`SIGTERM`), the dispatcher stops claiming new jobs, then workers drain in-flight jobs for up to `drain-timeout`.
- If `drain-timeout` is exceeded, in-flight handlers are cancelled and process shutdown continues.
- On **force kill** (`SIGKILL` / `kill -9`), no graceful cleanup runs. In-flight jobs remain locked until their lease expires, then are picked again by workers after restart.
- In practice, worst-case recovery delay after force kill is approximately `lease`.

## Tuning

The default settings (16 workers, 1s–2m backoff) work well for most deployments. Consider adjusting if:

- **High certificate volume**: increase `workers` and `queue-size`
- **Slow ADCS**: increase `max-backoff` and `lease` to tolerate longer processing times
- **Multi-node**: set a unique `worker-id` per instance to distinguish workers in logs
- **Many idle instances against a shared database (HA)**: raise `idle-max` to `1s`–`2s` to reduce the steady-state read load on the shared database. The defaults are tuned for a single-instance deployment, where the per-poll cost is negligible and tight polling keeps certificate-issuance latency low.

## Tuning Relationships

- Set `drain-timeout` to cover normal in-flight processing time during maintenance restarts.
- Keep `lease` long enough to avoid premature reclaim during transient slowdowns, while still allowing acceptable post-crash recovery time.
- In orchestrators, configure termination grace period to be greater than both `server.shutdown-timeout` and `workers.drain-timeout` (plus margin).

## Multi-node Deployments

Running multiple Hortval instances against the same database is supported (PostgreSQL, SQL Server). Each instance competes for job leases — only one instance processes each job. Set `worker-id` to a unique value per instance:

```yaml
# Node 1
workers:
  worker-id: "worker-node1"
```
```yaml
# Node 2
workers:
  worker-id: "worker-node2"
```
