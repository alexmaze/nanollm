#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${RAILWAY_VOLUME_MOUNT_PATH:-/data}"
CONFIG_PATH="${CONFIG_PATH:-$CONFIG_DIR/config.yaml}"
STORAGE_MODE="${NANOLLM_STORAGE:-sqlite}"

mkdir -p "$(dirname "$CONFIG_PATH")"

if [ ! -f "$CONFIG_PATH" ]; then
  if [ -z "${NANOLLM_ADMIN_PASSWORD:-}" ]; then
    echo "Missing NANOLLM_ADMIN_PASSWORD. Set it in Railway Variables before the first start." >&2
    exit 1
  fi

  cat > "$CONFIG_PATH" <<EOF
server:
  auth:
    admin:
      enabled: true
      username: ${NANOLLM_ADMIN_USERNAME:-admin}
      password: ${NANOLLM_ADMIN_PASSWORD}
    api:
      enabled: ${NANOLLM_API_AUTH_ENABLED:-false}
      token: ${NANOLLM_API_TOKEN:-}

models: []
fallback: {}
EOF

  echo "Initialized nanollm config at $CONFIG_PATH"
fi

HOME="$CONFIG_DIR" node dist/server.js --config "$CONFIG_PATH" --storage "$STORAGE_MODE"
