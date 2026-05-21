# Operator alert relay contract

swarm-push watches the relay SSE stream (`GET /api/events`) and delivers Web Push
notifications when messages are addressed to the operator (`session-primary` by
default). Lifecycle alerts use a dedicated envelope so they are not confused with
agent coordination mail.

## Accepted Envelopes

swarm-push accepts both relay shapes currently in use:

1. **Producer channel envelope** — deployed producers such as `agent-relay`
   write messages on `channel: "operator-alerts"` and JSON-encode the alert
   fields inside `body`.
2. **Simulation/direct envelope** — manual scripts can POST an already-expanded
   relay message with top-level `event: "operator_alert"` and `alert_category`.

### Producer channel envelope

POST `https://relay.swarm.bdev.norlem.com/api/messages` with the producer's
`X-Agent-Key`:

```json
{
  "to": "session-primary",
  "channel": "operator-alerts",
  "body": "{\"category\":\"cookie_auth_blocked\",\"agent_id\":\"codex-1234\",\"endpoint\":\"/api/agents/history\"}"
}
```

`body` must parse as a JSON object. `category` is treated as the alert category;
category-specific fields such as `agent_id`, `endpoint`, `expires_at`, `status`,
and `latency_ms` are read from that parsed body object.

For a real cookie-gate trigger path, use `/api/agents/history`; `/api/dashboard`
can be redirected at the CloudFront edge before it reaches relay, so it is not a
canonical trigger path.

### Simulation/direct envelope

POST `https://relay.swarm.bdev.norlem.com/api/messages` with the producer's
`X-Agent-Key`:

```json
{
  "to": "session-primary",
  "channel": "agent-coordination",
  "event": "operator_alert",
  "alert_category": "<category>",
  "...": "category-specific fields"
}
```

For this direct shape, `event` must be `operator_alert`.

For both shapes, the alert category is one of:

| Category | Producer (intended) | Required fields |
|----------|---------------------|-----------------|
| `cookie_expiry_warning` | `agent-mgtm-auth` or `swarm-architect` | `expires_at` (ISO), optional `minutes_remaining` (default 5) |
| `cookie_auth_blocked` | `agent-relay` or fleet worker on HTTP 401 | `agent_id`, `endpoint` |
| `cookie_refreshed` | `agent-mgtm-auth` / Console BFF | `expires_at` (ISO) |
| `canary_failed` | `swarm-architect` (`fabric-budget-canary`) | `status`, optional `latency_ms` |

## Debounce

swarm-push drops repeat notifications for the same debounce key within **10 minutes**:

- All categories: one push per `alert_category` per 10 min (except below).
- `cookie_auth_blocked`: one push per `(category, agent_id)` per 10 min.

## Deep links

| Category | Console URL |
|----------|-------------|
| `cookie_expiry_warning`, `cookie_refreshed` | `/credentials` |
| `cookie_auth_blocked` | `/agents/<agent_id>` or `/fleet` |
| `canary_failed` | `/budget` |

## Example: canary failure

```json
{
  "to": "session-primary",
  "channel": "agent-coordination",
  "event": "operator_alert",
  "alert_category": "canary_failed",
  "status": "503",
  "latency_ms": 842
}
```

Push title: **Budget canary FAILED**  
Push body: `Canary FAILED: 503 / latency 842ms. Check budget providers in Console.`

## Producer rollout (follow-up PRs)

1. **agent-mgtm-auth** — scheduled check of operator session `exp`; emit
   `cookie_expiry_warning` ~5 min before expiry; emit `cookie_refreshed` after
   successful mint/refresh.
2. **agent-relay** — on cookie-gate 401 for agent data-path calls, emit
   `cookie_auth_blocked` (include `from_agent_id` + request path).
3. **swarm-architect** — `fabric-budget-canary` non-success → `canary_failed`;
   Mac-side cookie cache expiry → `cookie_expiry_warning`.
