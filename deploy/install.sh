#!/usr/bin/env bash
# Deploy swarm-push to fleet-manager EC2.
# Run via SSM: aws ssm send-command ...
set -euo pipefail

DEST=/opt/swarm-push
APP_USER=fleet

# Install Node.js 20 if not present
if ! command -v node &>/dev/null || [[ "$(node --version)" < "v20" ]]; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  yum install -y nodejs
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
