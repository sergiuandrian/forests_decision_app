#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"
export PYTHONPATH="$ROOT/backend"

cd "$ROOT/backend"
uvicorn app.main:app --host 127.0.0.1 --port 8000
