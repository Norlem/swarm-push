#!/usr/bin/env bash
# Emit a test operator_alert to relay (acceptance / manual verification).
# Requires RELAY_URL and RELAY_AGENT_KEY (swarm-push identity key).
set -euo pipefail

CATEGORY="${1:?usage: $0 <cookie_expiry_warning|cookie_auth_blocked|cookie_refreshed|canary_failed>}"
RELAY_URL="${RELAY_URL:-https://relay.swarm.bdev.norlem.com}"
RELAY_AGENT_KEY="${RELAY_AGENT_KEY:?set RELAY_AGENT_KEY}"

case "$CATEGORY" in
  cookie_expiry_warning)
    EXTRA='"expires_at":"2099-01-01T00:00:00Z","minutes_remaining":5'
    ;;
  cookie_auth_blocked)
    EXTRA='"agent_id":"test-agent","endpoint":"/api/inbox/test"'
    ;;
  cookie_refreshed)
    EXTRA='"expires_at":"2099-01-01T12:00:00Z"'
    ;;
  canary_failed)
    EXTRA='"status":"503","latency_ms":999'
    ;;
  *)
    echo "unknown category: $CATEGORY" >&2
    exit 1
    ;;
esac

payload=$(cat <<EOF
{"to":"session-primary","channel":"agent-coordination","event":"operator_alert","alert_category":"${CATEGORY}",${EXTRA}}
EOF
)

curl -fsS -X POST "${RELAY_URL%/}/api/messages" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Key: ${RELAY_AGENT_KEY}" \
  -d "$payload"

echo
echo "sent operator_alert category=${CATEGORY}"
