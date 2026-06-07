import { connect } from 'tls';
import { connect as netConnect } from 'net';
import { URL, fileURLToPath } from 'url';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import express from 'express';
import { createServer }  from 'http';
import http from 'http';
import path from "path";

/** Default port if none specified. Will host both HTTP and WebSocket proxy. */
const PROXY_PORT = 8080;

const serverParams = getServerParams();

const server = startServer(serverParams);

const wss = new WebSocketServer({ server: server });

server.listen(PROXY_PORT, () => {
  console.log(`Server running on port ${PROXY_PORT}`);
  console.log(`Express (HTTP) and WebSocket (ws) are sharing this port`);
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
    if (!mudSocket.writable) return;

    if (typeof data === 'string') {
      mudSocket.write(data);
    } else if (Array.isArray(data)) {
      mudSocket.write(Buffer.concat(data));
    } else if (data instanceof ArrayBuffer) {
      mudSocket.write(Buffer.from(data));
    } else {
      mudSocket.write(data);
    }
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
      if (i + 1 >= buf.length) break;
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

function startServer(p: IServerParams) {
  let httpServer: http.Server<typeof http.IncomingMessage, typeof http.ServerResponse> | undefined = undefined;

  if (!p.port) {
    console.log('Cannot start HTTP server, port not specified. Pass param \'httpPort\' to set the port to use.');
  }

  const app = express();

  httpServer = createServer(app);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const __staticPathOffset = '..'
  const __staticPath = path.join(__dirname, __staticPathOffset);

  // serve static files.
  app.use(express.static(__staticPath));
  app.get("/{*path}", (req, res) => {
    res.sendFile(path.resolve(__dirname, __staticPathOffset, 'index.html'));
  });

  if (!httpServer) {
    throw 'Server not loaded';
  }

  return httpServer;
}

/** Process node command line params (not connection params). */
function getServerParams(): IServerParams {
  let serve = false;
  let port = PROXY_PORT;
  process.argv.forEach((v, i) => {
    // skip ['node.exe', 'proxy.js']
    if (i < 2)
      return;

    // serve on the default port.
    if (v == 'serve') {
      serve = true;
      return;
    }

    // serve on specific port with 'httpPort=8090'.
    if (v.startsWith('port=')) {
      const paramPort = v.split('=')[1];
      serve = true;
      port = +paramPort;
    }
  });

  return {
    serveHttp: serve,
    port,
  };
}

interface IServerParams {
  serveHttp: boolean;
  port: number;
}
