#!/usr/bin/env bash
# qa-fallback.sh — serve the page from a directory that does NOT contain the
# mp3 (exactly what the GitHub repo looks like, since the 1 MB binary cannot go
# through the API) and prove the audio still loads via the hosted fallback.
#
# usage: bash tools/qa-fallback.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=8231
DIR="$(mktemp -d)"

export LD_LIBRARY_PATH="$ROOT/.browserlibs/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export FONTCONFIG_FILE="$ROOT/.browserlibs/fonts.conf"

cp "$ROOT/public/index.html" "$DIR/"
[ ! -e "$DIR/tu-jaane-na.mp3" ] || { echo "fixture error: mp3 leaked into $DIR"; exit 1; }

( node "$ROOT/tools/serve-public.js" "$PORT" "$DIR" >/tmp/qa-fallback-serve.log 2>&1 & echo $! > "$DIR/pid" )
trap 'kill "$(cat "$DIR/pid" 2>/dev/null)" 2>/dev/null || true; rm -rf "$DIR"' EXIT
sleep 1.5

curl -sf -o /dev/null "http://127.0.0.1:$PORT/" || { echo "static server failed to start"; exit 1; }
code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/tu-jaane-na.mp3")"
echo "fixture: page 200, mp3 $code (must be 404 so the fallback is the only path)"
[ "$code" = "404" ] || { echo "fixture error: expected the mp3 to be missing"; exit 1; }

echo
node "$ROOT/tools/track-fallback-check.js" "http://127.0.0.1:$PORT/" fallback

# and the normal case: the file is there, so the local copy must win
cp "$ROOT/public/tu-jaane-na.mp3" "$DIR/"
echo
node "$ROOT/tools/track-fallback-check.js" "http://127.0.0.1:$PORT/" local
