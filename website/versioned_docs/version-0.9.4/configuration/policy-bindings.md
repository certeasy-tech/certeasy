---
sidebar_position: 5
title: Policy Bindings
---

# Policy Bindings

Policy bindings connect **issuance policies** to **authorities**. They define which ADCS backend(s) handle certificate requests for a given policy, and the selection strategy when multiple authorities are available.

## Configuration

```yaml
policy-bindings:
  - policy: corp-server
    authorities:
      - ca1
      - ca2
    strategy: first_available
```

## Fields

| Field | Default | Description |
|---|---|---|
| `policy` | — | Name of the issuance policy |
| `authorities` | — | List of authority names to use for this policy |
| `strategy` | `first_available` | Selection strategy when multiple authorities are listed |

## Strategies

### `first_available`

Certeasy tries the first authority. If it fails (unreachable, error), it moves to the next. This provides **failover**.

```yaml
strategy: first_available
```

Use this when you have a primary CA and a backup.

### `round_robin`

Certeasy distributes requests evenly across all listed authorities. This provides **load balancing**.

```yaml
strategy: round_robin
```

Use this when you have multiple equivalent CAs and want to spread load.

## Implicit Binding

If `policy-bindings` is omitted entirely and the configuration has **exactly one issuance policy and one authority**, Certeasy creates an implicit binding:

- policy → the only issuance policy
- authorities → the only authority
- strategy → `first_available`

This simplifies minimal configurations. As soon as you add a second policy or a second authority, you must declare bindings explicitly.

## Multiple Policies Example

```yaml
policy-bindings:
  - policy: corp-servers
    authorities:
      - adcs-primary
      - adcs-backup
    strategy: first_available

  - policy: dmz-servers
    authorities:
      - adcs-dmz
    strategy: first_available
```

## Validation Rules

At startup, Certeasy verifies:
- Every issuance policy has exactly one binding
- Every authority referenced in a binding exists
- No dangling or duplicate bindings
