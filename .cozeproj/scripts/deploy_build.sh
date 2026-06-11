#!/bin/bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_DIR"

if ! command -v pnpm &>/dev/null; then
  echo "Enabling pnpm via corepack..."
  corepack enable pnpm
fi

echo "Installing dependencies..."
pnpm install

echo "Building the project..."
pnpm run build

echo "Build completed successfully!"
