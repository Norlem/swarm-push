# Operator alert relay contract

swarm-push watches the relay SSE stream (`GET /api/events`) and delivers Web Push
notifications when messages are addressed to the operator (`session-primary` by
default). Lifecycle alerts use a dedicated envelope so they are not confused with
agent coordination mail.

## Envelope

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

`event` must be `operator_alert`. `alert_category` is one of:

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
