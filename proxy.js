const tls = require('tls');
const net = require('net');
const WebSocket = require('ws');
const { URL } = require('url');

const PROXY_PORT = 8080;
const wss = new WebSocket.Server({ port: PROXY_PORT });

function stripTelnet(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] === 0xFF) {
      if (i + 1 >= buf.length) break;
      const cmd = buf[i + 1];
      if (cmd >= 0xFB && cmd <= 0xFE) {
        i += 3;
      } else if (cmd === 0xF0) {
        i += 2;
      } else if (cmd === 0xFA) {
        i += 2;
        while (i + 1 < buf.length && !(buf[i] === 0xFF && buf[i + 1] === 0xF0)) i++;
        if (i + 1 < buf.length) i += 2;
      } else {
        i += 2;
      }
    } else {
      out.push(buf[i]);
      i++;
    }
  }
  return Buffer.from(out);
}

wss.on('connection', (ws, req) => {
  const params = new URL(req.url, `ws://localhost:${PROXY_PORT}`);
  const host = params.searchParams.get('host');
  const port = parseInt(params.searchParams.get('port'));
  const useTLS = params.searchParams.get('tls') !== 'false';

  if (!host || !port) {
    ws.close(1008, 'Missing host or port');
    return;
  }

  console.log(`Connecting to ${host}:${port} (${useTLS ? 'TLS' : 'plain'})`);

  const mudSocket = useTLS
  ? tls.connect({ host, port, rejectUnauthorized: false })
  : net.connect({ host, port });

  mudSocket.on('data', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(stripTelnet(data).toString('utf8').replace(/\r+\n/g, '\n'));
    }
  });

  ws.on('message', (data) => {
    if (mudSocket.writable) mudSocket.write(data);
  });

    mudSocket.on('close', () => ws.close());
    mudSocket.on('error', (err) => {
      console.error(`MUD socket error (${host}:${port}):`, err.message);
      ws.close();
    });

    ws.on('close', () => mudSocket.destroy());
    ws.on('error', () => mudSocket.destroy());
});

console.log(`Proxy running on ws://localhost:${PROXY_PORT}`);
