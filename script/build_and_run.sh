#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
npm run build:mac:dir
codesign --verify --deep --strict "$ROOT_DIR/dist/mac-arm64/Mineradio.app"
if pgrep -x Mineradio >/dev/null; then
  pkill -TERM -x Mineradio
  for attempt in {1..50}; do
    pgrep -x Mineradio >/dev/null || break
    sleep 0.2
  done
  if pgrep -x Mineradio >/dev/null; then
    echo 'Mineradio has not exited; stop before relaunching.' >&2
    exit 1
  fi
fi
open "$ROOT_DIR/dist/mac-arm64/Mineradio.app"
if [[ "${1:-}" == '--verify' ]]; then
  sleep 3
  pgrep -x Mineradio >/dev/null
fi
