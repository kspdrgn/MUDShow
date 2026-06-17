import express from 'express';
import { createServer } from 'node:http';
import { connect as netConnect } from 'node:net';
import { connect } from 'node:tls';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

const PROXY_PORT = 8080;

const server = startServer();
const wss = new WebSocketServer({ server });

server.listen(PROXY_PORT, () => {
  console.log(`Server running on port ${PROXY_PORT}`);
  console.log('Express (HTTP) and WebSocket (ws) are sharing this port');
});

wss.on('connection', (ws, req) => {
  const params = new URL(req.url ?? '', `ws://localhost:${PROXY_PORT}`);
  const host = params.searchParams.get('host');
  const port = Number(params.searchParams.get('port') ?? '0');
  const useTLS = params.searchParams.get('tls') !== 'false';

  if (!host || !port) {
    ws.close(1008, 'Missing host or port');
    return;
  }

  console.log(`Connecting to ${host}:${port} (${useTLS ? 'TLS' : 'plain'})`);

  const mudSocket = useTLS
    ? connect({ host, port, rejectUnauthorized: false })
    : netConnect({ host, port });

  mudSocket.on('data', (data: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(stripTelnet(data).toString('utf8').replace(/\r+\n/g, '\n'));
    }
  });

  ws.on('message', (data: RawData) => {
    if (!mudSocket.writable) {
      return;
    }

    if (typeof data === 'string') {
      mudSocket.write(data);
      return;
    }

    if (Array.isArray(data)) {
      mudSocket.write(Buffer.concat(data));
      return;
    }

    if (data instanceof ArrayBuffer) {
      mudSocket.write(Buffer.from(data));
      return;
    }

    mudSocket.write(data);
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

function stripTelnet(buf: Buffer): Buffer {
  const out: number[] = [];
  let i = 0;

  while (i < buf.length) {
    if (buf[i] === 0xff) {
      if (i + 1 >= buf.length) {
        break;
      }

      const cmd = buf[i + 1];

      if (cmd >= 0xfb && cmd <= 0xfe) {
        i += 3;
      } else if (cmd === 0xf0) {
        i += 2;
      } else if (cmd === 0xfa) {
        i += 2;

        while (i + 1 < buf.length && !(buf[i] === 0xff && buf[i + 1] === 0xf0)) {
          i++;
        }

        if (i + 1 < buf.length) {
          i += 2;
        }
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

function startServer() {
  const app = express();
  const server = createServer(app);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDir = path.resolve(__dirname, '..', 'frontend');

  app.use(express.static(frontendDir));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.resolve(frontendDir, 'index.html'));
  });

  return server;
}
