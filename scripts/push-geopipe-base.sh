#!/usr/bin/env bash
# Push the standalone GeoPipe base project to https://github.com/sergiuandrian/geopipe
# Run this from a machine authenticated as sergiuandrian (gh auth login / git credentials).
set -euo pipefail

DEST="${1:-https://github.com/sergiuandrian/geopipe.git}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUNDLE="$SCRIPT_DIR/geopipe-main.bundle"

if [[ ! -f "$BUNDLE" ]]; then
  echo "Missing bundle: $BUNDLE" >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

git clone "$BUNDLE" "$WORKDIR/geopipe"
cd "$WORKDIR/geopipe"
git remote remove origin 2>/dev/null || true
git remote add origin "$DEST"
git push -u origin main
echo "Pushed GeoPipe base → $DEST"
