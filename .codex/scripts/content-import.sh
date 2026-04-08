#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$ROOT_DIR"
exec ./scripts/with-node.sh pnpm content:import -- --content-root ./content
