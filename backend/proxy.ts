import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { connect as netConnect, Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTelnet } from './telnet.js';

const PROXY_PORT = 8080;
const disableHttp = ['1', 'true'].includes((process.env.MUDSHOW_DISABLE_HTTP ?? '').toLowerCase());

const server = disableHttp ? createServer() : createServer(handleHttpRequest);
server.on('upgrade', handleWebSocketUpgrade);
server.listen(PROXY_PORT, () => {
  console.log(`HTTP: http://localhost:${PROXY_PORT}`);
  console.log(`Proxy: ws://localhost:${PROXY_PORT}`);
});

function handleHttpRequest(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) {
  if (disableHttp) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Desktop sidecar does not serve HTTP content.');
    return;
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendDir = path.resolve(__dirname, '..', 'frontend');
  const requestUrl = new URL(req.url ?? '/', 'http://localhost');
  const requestPath = decodeURIComponent(requestUrl.pathname);
  const candidate = requestPath === '/' ? 'index.html' : requestPath.slice(1);
  const resolved = path.resolve(frontendDir, candidate);

  if (!resolved.startsWith(frontendDir)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  const filePath = existsSync(resolved) && statSync(resolved).isFile()
    ? resolved
    : path.resolve(frontendDir, 'index.html');

  sendFile(res, filePath);
}

function sendFile(res: import('node:http').ServerResponse, filePath: string) {
  const contentType = getContentType(filePath);
  res.writeHead(200, {
    'content-type': contentType,
    'cache-control': 'no-cache',
  });
  res.end(readFileSync(filePath));
}

function getContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function handleWebSocketUpgrade(req: import('node:http').IncomingMessage, socket: Socket, head: Buffer) {
  const params = new URL(req.url ?? '', `ws://localhost:${PROXY_PORT}`);
  const host = params.searchParams.get('host');
  const port = Number(params.searchParams.get('port') ?? '0');
  const useTLS = params.searchParams.get('tls') !== 'false';

  if (!host || !port) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\nMissing host or port');
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\nMissing WebSocket key');
    return;
  }

  const accept = createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'),
  );

  const mudSocket = useTLS
    ? tlsConnect({ host, port, rejectUnauthorized: false })
    : netConnect({ host, port });

  const session = new WebSocketSession(socket, mudSocket);
  if (head.length > 0) {
    session.pushClientData(head);
  }
}

class WebSocketSession {
  private clientBuffer = Buffer.alloc(0);
  private closed = false;

  constructor(
    private readonly client: Socket,
    private readonly mudSocket: Socket,
  ) {
    this.client.on('data', (data: Buffer) => this.handleClientData(data));
    this.client.on('close', () => this.close());
    this.client.on('error', () => this.close());

    this.mudSocket.on('data', (data: Buffer) => {
      if (!this.closed) {
        this.sendText(stripTelnet(data).toString('utf8').replace(/\r+\n/g, '\n'));
      }
    });
    this.mudSocket.on('close', () => this.close());
    this.mudSocket.on('error', (err) => {
      console.error(`MUD socket error: ${err.message}`);
      this.close();
    });
  }

  pushClientData(data: Buffer) {
    this.clientBuffer = Buffer.concat([this.clientBuffer, data]);
    this.parseClientFrames();
  }

  private handleClientData(data: Buffer) {
    this.pushClientData(data);
  }

  private parseClientFrames() {
    while (!this.closed) {
      if (this.clientBuffer.length < 2) {
        return;
      }

      const first = this.clientBuffer[0];
      const second = this.clientBuffer[1];
      const opcode = first & 0x0f;
      const masked = (second & 0x80) !== 0;
      let payloadLength = second & 0x7f;
      let offset = 2;

      if (!masked) {
        this.close();
        return;
      }

      if (payloadLength === 126) {
        if (this.clientBuffer.length < offset + 2) {
          return;
        }

        payloadLength = this.clientBuffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (this.clientBuffer.length < offset + 8) {
          return;
        }

        const high = this.clientBuffer.readUInt32BE(offset);
        const low = this.clientBuffer.readUInt32BE(offset + 4);
        if (high !== 0) {
          this.close();
          return;
        }

        payloadLength = low;
        offset += 8;
      }

      if (this.clientBuffer.length < offset + 4 + payloadLength) {
        return;
      }

      const mask = this.clientBuffer.subarray(offset, offset + 4);
      offset += 4;
      const payload = this.clientBuffer.subarray(offset, offset + payloadLength);
      const unmasked = Buffer.allocUnsafe(payloadLength);
      for (let i = 0; i < payloadLength; i++) {
        unmasked[i] = payload[i] ^ mask[i % 4];
      }

      this.clientBuffer = this.clientBuffer.subarray(offset + payloadLength);

      if (opcode === 0x8) {
        this.close();
        return;
      }

      if (opcode === 0x9) {
        this.sendFrame(0x0a, unmasked);
        continue;
      }

      if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
        if (this.mudSocket.writable) {
          this.mudSocket.write(Buffer.from(unmasked));
        }
      }
    }
  }

  private sendText(text: string) {
    this.sendFrame(0x1, Buffer.from(text, 'utf8'));
  }

  private sendFrame(opcode: number, payload: Buffer) {
    if (this.closed || this.client.destroyed) {
      return;
    }

    let header: Buffer;
    if (payload.length < 126) {
      header = Buffer.allocUnsafe(2);
      header[0] = 0x80 | opcode;
      header[1] = payload.length;
    } else if (payload.length < 0x10000) {
      header = Buffer.allocUnsafe(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.allocUnsafe(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(payload.length, 6);
    }

    this.client.write(Buffer.concat([header, payload]));
  }

  private close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.clientBuffer = Buffer.alloc(0);
    if (!this.client.destroyed) {
      this.client.destroy();
    }
    if (!this.mudSocket.destroyed) {
      this.mudSocket.destroy();
    }
  }
}
