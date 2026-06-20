#!/usr/bin/env fish
# Requires a built dist/ tree and a globally available node binary.
cd (dirname (status filename))
node dist/backend/proxy.js port=8080 &
set PROXY_PID $last_pid
sleep 0.5
xdg-open http://localhost:8080
function cleanup --on-signal INT --on-signal TERM
    kill $PROXY_PID 2>/dev/null
end
wait $PROXY_PID
