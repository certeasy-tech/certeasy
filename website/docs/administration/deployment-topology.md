---
sidebar_position: 1
title: Deployment topology
---

# Deployment topology

Certeasy is designed and supported as a **single-instance** deployment. This page documents which topologies are supported today, and which ones will silently break your installation if you try.

## Supported

### Single instance (recommended)

One Certeasy process on one host, with its own database. This is the production-ready topology.

```
┌──────────────┐    HTTPS     ┌──────────────┐    RPC       ┌──────────┐
│ ACME clients │ ──────────►  │   Certeasy   │ ───────────► │   ADCS   │
└──────────────┘              └──────────────┘              └──────────┘
                                     │
                                     ▼
                              ┌──────────────────┐
                              │     Database     │
                              │  SQLite / PG /   │
                              │    SQL Server    │
                              └──────────────────┘
```

This covers the vast majority of enterprise PKI volumes. A single Certeasy instance on a modest Windows Server processes several certificate orders per second.

### Cold Active / Passive (manual switchover)

You can install Certeasy on two hosts for failover, **as long as only one instance is running at a time**. The standby is fully stopped (process not running, port not bound). The administrator switches manually : stop the active node, then start the standby.

```
┌──────────────────────────────────────────┐
│              VIP / LB                    │
└──────────────────┬───────────────────────┘
                   │ HTTPS
        ┌──────────┴──────────┐
        ▼                     ▼
   ┌────────┐            ┌──────────┐
   │ Node A │            │  Node B  │
   │ ACTIVE │            │ STOPPED  │
   └────┬───┘            └──────────┘
        │
        ▼
   ┌────────────────────────────────────┐
   │ Shared DB (PostgreSQL / SQL Server)│
   └────────────────────────────────────┘
```

Requirements for this topology :

- **Database must be PostgreSQL or SQL Server.** SQLite is **NOT supported** for any multi-host setup: its file-level locking is not reliable across hosts on shared filesystems (NFS, SMB, etc.) and corruption is a matter of when, not if.
- Each node has its **own local work directory** (TLS cache, transient files, audit log). The work directory does not need to be shared.
- The administrator owns the switchover discipline: **never start the standby before the active is fully stopped.** Starting two instances against the same database is the unsupported Active / Active topology described below — pathologies will appear silently.

Switchover procedure:

1. Stop Certeasy on the active node (graceful shutdown drains in-flight ACME requests).
2. Start Certeasy on the standby node.
3. Update your load balancer to route to the new active node.

Expected switchover time: typically under a minute, including the standby's boot probe.

### Load balancer in front of a single instance

A reverse proxy or load balancer in front of a single Certeasy instance — for TLS termination, IP filtering, geo-routing, etc. — is fully supported. Forward the `Host` header and preserve the client IP if your audit log relies on it.

## NOT supported — Active / Active

Running two or more Certeasy instances **concurrently** against the same database **is not supported** in the current release. Several core mechanisms hold in-process state that does not coordinate across nodes:

| Subsystem | What breaks under Active / Active |
|---|---|
| **ACME nonces** | Each instance generates nonces with its own secret and tracks them in local memory. A client whose first request lands on node A and second request lands on node B is rejected with `badNonce`, forcing a fresh `newNonce` call every two requests. Replay protection is also local per node — the same nonce can be rejected by one node and accepted by another within its 2-minute TTL. |
| **Rate limiting** | Several limits (failed-validation back-off, account-creation throttling, order-creation throttling, global) are in-memory per instance. A client hitting two nodes can effectively double its quota. |
| **License enforcement** | Per-instance counters for `max_managed_servers`. Two instances can both believe they are under the limit while the cluster as a whole has already exceeded it. |
| **PKI health checks** | Each instance pings the configured CAs independently. Operationally noisy in logs, not corruption-inducing. |
| **TLS certificate manager** | Each instance maintains its own server-certificate cache on disk. Two instances behind the same hostname will fetch or issue their TLS cert independently — risk of double-consuming a Let's Encrypt quota or returning different chains depending on which node a client lands on. |

**Failure modes are silent and intermittent.** Clients see sporadic `badNonce` errors, rate limits feel inconsistent, license counters drift, certificate behaviour depends on which node terminates the TLS handshake. Diagnosing these in production after the fact is painful.

### Why sticky sessions do not fix this

A load balancer with session affinity (cookie-based) does **not** solve the nonce problem in practice : the standard ACME clients (lego, certbot, acme.sh, native Go clients) do not enable an HTTP cookie jar for their ACME requests, so a `Set-Cookie` from the load balancer is ignored. Source-IP affinity is more reliable but breaks the moment clients sit behind a NAT, a corporate proxy, or a CGNAT.

If you need true multi-node availability today, use **cold Active / Passive** above and accept the manual switchover. True warm Active / Passive and Active / Active deployments are tracked on the [public roadmap](../intro/roadmap.md) for V2.0 Enterprise.

## Database backend behind a single instance

Independently of the Certeasy topology, the database tier can run its own HA setup:

- **SQLite WAL** — concurrent readers + single writer. Adequate for single-instance Certeasy. Not usable across hosts.
- **PostgreSQL with replication** — primary + read replicas for backup and reporting. Certeasy only writes to the primary. Database-level failover (e.g. `pg_auto_failover`, Patroni) is transparent to Certeasy as long as the connection string resolves to the new primary after the cut.
- **SQL Server with Always On / mirroring** — same principle. Certeasy connects to one target ; failover at the database tier is handled by the listener / cluster role.

In all cases, scaling the database tier does **not** unlock Active / Active for Certeasy itself.
