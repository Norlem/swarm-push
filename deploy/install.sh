#!/usr/bin/env bash
# Deploy swarm-push to fleet-manager EC2 (Debian/Ubuntu).
# Run via SSM: aws ssm send-command ...
#
# Prerequisites:
#   1. /etc/swarm-push.env must exist with RELAY_AGENT_KEY, VAPID_PUBLIC_KEY,
#      VAPID_PRIVATE_KEY, OPERATOR_ID set (operator-managed, never in git).
#   2. nginx /push/ proxy location must be present in the fleet-manager nginx
#      config (see nginx-push-location.conf in this directory).
#   3. CloudFront /push/* behavior must target the fleet-manager-ec2 origin
#      (port 80), not a direct port-5200 origin.
set -euo pipefail

DEST=/opt/swarm-push
APP_USER=fleet

# Install Node.js 20 if not present (Debian/Ubuntu)
if ! command -v node &>/dev/null || [[ "$(node --version)" < "v20" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# Create dirs
mkdir -p "$DEST"
mkdir -p /opt/swarm-push-data

# Copy app files (assumes this script runs after files are placed in /tmp/swarm-push-pkg/)
cp -r /tmp/swarm-push-pkg/dist "$DEST/"
cp -r /tmp/swarm-push-pkg/node_modules "$DEST/"
cp /tmp/swarm-push-pkg/package.json "$DEST/"

chown -R "$APP_USER:$APP_USER" "$DEST" /opt/swarm-push-data

# Install and enable systemd service
cp /tmp/swarm-push-pkg/deploy/swarm-push.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable swarm-push
systemctl restart swarm-push
systemctl status swarm-push --no-pager
