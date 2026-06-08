#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

PORT="${DEPLOY_RUN_PORT:-5000}"

# Next.js image optimization 需要 cache/images 目录存在
mkdir -p .next/cache/images

start_service() {
  echo "Starting HTTP service on port ${PORT} for deploy..."
  pnpm run start --port "${PORT}"
}

start_service
