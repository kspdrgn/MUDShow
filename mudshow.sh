#!/bin/bash
cd "$(dirname "$0")"
node proxy.js &
PROXY_PID=$!
trap "kill $PROXY_PID 2>/dev/null" EXIT INT TERM
sleep 0.5
xdg-open mudshow.html
echo "MUDShow launch script successful. Ctrl+C-ing to kill the script should kill the proxy too."
wait $PROXY_PID
