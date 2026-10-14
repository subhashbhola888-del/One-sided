#!/usr/bin/env bash
# qa.sh — run the layout/overflow QA against the built page in a real
# headless Chromium. Records the exact setup this VM needs (no root):
#   · Chromium's shared libs are unpacked into .browserlibs/root
#   · a fontconfig conf points at the fonts unpacked into .browserlibs/fonts
#     (this image has NO system fonts, so text otherwise lays out at zero
#      size and every measurement is meaningless)
#
# usage: bash tools/qa.sh <dir-to-serve> [shots-dir]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${1:-$ROOT/public}"
SHOTS="${2:-}"
PORT=8199

export LD_LIBRARY_PATH="$ROOT/.browserlibs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export FONTCONFIG_FILE="$ROOT/.browserlibs/fonts.conf"

node "$ROOT/tools/serve-public.js" "$PORT" "$DIR" >/tmp/qa-serve.log 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
sleep 1.5
curl -sf -o /dev/null "http://127.0.0.1:$PORT/" || { echo "static server failed to start"; exit 1; }

if [ -n "$SHOTS" ]; then
  node "$ROOT/tools/fit-check.js" "http://127.0.0.1:$PORT/" --shots "$SHOTS"
else
  node "$ROOT/tools/fit-check.js" "http://127.0.0.1:$PORT/"
fi
