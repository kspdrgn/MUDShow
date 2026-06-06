import { connect } from 'tls';
import { connect as netConnect } from 'net';
import { URL } from 'url';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import http from 'http';
import fs from 'fs';

const PROXY_PORT = 8080;
const htmlIndexPath = './dist/mudshow.html';

// process node command line params (not connection params).
let httpServe = false;
let httpPort = 8090;
process.argv.forEach((v, i) => {
  // skip ['node.exe', 'proxy.js']
  if (i < 2)
    return;

  // serve on the default port.
  if (v == 'httpServe') {
    httpServe = true;
    return;
  }

  // serve on specific port with 'httpPort=8090'.
  if (v.startsWith('httpPort=')) {
    const paramPort = v.split('=')[1];
    httpServe = true;
    httpPort = +paramPort;
  }
});

// run a mini http server if UPGRADE header doesn't work.
if (httpServe) {
  if (!httpPort) {
    console.log('Cannot start HTTP server, port not specified. Pass param \'httpPort\' to set the port to use.');
  } else {
    const httpServer = http.createServer((req, res) => {
      fs.createReadStream(htmlIndexPath).pipe(res);
    });

    new WebSocketServer({ server: httpServer });

    httpServer.listen(httpPort);
    console.log(`Web listening on http://localhost:${httpPort}`);
  }
}

const wss = new WebSocketServer({ port: PROXY_PORT });

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

wss.on('connection', (ws, req) => {
  const params = new URL(req.url ?? '', `ws://localhost:${PROXY_PORT}`);
  const host = params.searchParams.get('host');
  const port = Number(params.searchParams.get('port') ?? '0');
  const useTLS = params.searchParams.get('tls') !== 'false';
  debugger;

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
