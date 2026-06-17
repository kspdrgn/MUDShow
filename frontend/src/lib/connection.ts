type Handlers = {
  onOpen: () => void;
  onMessage: (text: string) => void;
  onClose: () => void;
  onError: () => void;
};

export class MudConnection {
  private socket: WebSocket | null = null;

  connect(url: string, handlers: Handlers): void {
    this.close();

    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => handlers.onOpen();
    socket.onmessage = (event) => {
      if (typeof event.data === 'string') {
        handlers.onMessage(event.data);
        return;
      }

      if (event.data instanceof ArrayBuffer) {
        handlers.onMessage(new TextDecoder().decode(event.data));
      }
    };
    socket.onclose = () => handlers.onClose();
    socket.onerror = () => handlers.onError();
    this.socket = socket;
  }

  send(text: string): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(text);
    }
  }

  close(): void {
    if (!this.socket) {
      return;
    }

    this.socket.onopen = null;
    this.socket.onmessage = null;
    this.socket.onclose = null;
    this.socket.onerror = null;
    this.socket.close();
    this.socket = null;
  }

  get readyState(): number {
    return this.socket?.readyState ?? WebSocket.CLOSED;
  }
}
