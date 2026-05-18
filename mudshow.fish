#!/usr/bin/env fish
cd (dirname (status filename))
node proxy.js &
set PROXY_PID $last_pid
sleep 0.5
xdg-open mudshow.html
function cleanup --on-signal INT --on-signal TERM
    kill $PROXY_PID 2>/dev/null
end
wait $PROXY_PID
