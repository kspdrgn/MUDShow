#!/bin/bash
# Requires a built dist/ tree and a globally available node binary.
cd "$(dirname "$0")"
node dist/backend/proxy.js port=8080 &
PROXY_PID=$!
trap "kill $PROXY_PID 2>/dev/null" EXIT INT TERM
sleep 0.5
xdg-open http://localhost:8080
echo "MUDShow launch script successful. Ctrl+C-ing to kill the script should kill the proxy too."
wait $PROXY_PID
