#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

PORT="${DEPLOY_RUN_PORT:-5000}"

start_service() {
  if ! command -v pnpm &>/dev/null; then
    echo "Enabling pnpm via corepack..."
    corepack enable pnpm
  fi

  echo "Starting HTTP service on port ${PORT} for deploy..."
  pnpm run start --port "${PORT}"
}

start_service
