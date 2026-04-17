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
  workers: 4
  lease: 30s
  idle-min: 200ms
  idle-max: 5s
  base-backoff: 1s
  max-backoff: 2m
  queue-size: 4
```

## Fields

| Field | Default | Description |
|---|---|---|
| `worker-id` | `worker` | Unique identifier for this worker instance. Useful in multi-node deployments. |
| `workers` | `4` | Number of concurrent worker goroutines. |
| `lease` | `30s` | How long a worker holds a job lock. If processing takes longer, the lease is renewed automatically. |
| `idle-min` | `200ms` | Minimum polling interval when the queue is empty. |
| `idle-max` | `5s` | Maximum polling interval when the queue is empty. |
| `base-backoff` | `1s` | Initial backoff on job failure. |
| `max-backoff` | `2m` | Maximum backoff after repeated failures. |
| `queue-size` | value of `workers` | In-memory job queue buffer size. |

## How the Job Engine Works

All background work in Certeasy (DNS challenge validation, ADCS polling) is handled by the job engine:

1. An ACME handler enqueues a job in the database
2. A worker picks up the job and acquires a lease
3. The worker executes the job handler (validate DNS, poll ADCS…)
4. On success, the job is marked complete
5. On transient failure, the job is rescheduled with exponential backoff
6. On fatal failure, the job is failed and the associated order is invalidated

Jobs are persistent — if Certeasy restarts mid-processing, workers resume from the database.

## Tuning

The default settings (4 workers, 1s–2m backoff) work well for most deployments. Consider adjusting if:

- **High certificate volume**: increase `workers` and `queue-size`
- **Slow ADCS**: increase `max-backoff` and `lease` to tolerate longer processing times
- **Multi-node**: set a unique `worker-id` per instance to distinguish workers in logs

## Multi-node Deployments

Running multiple Certeasy instances against the same database is supported. Each instance competes for job leases — only one instance processes each job. Set `worker-id` to a unique value per instance:

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
