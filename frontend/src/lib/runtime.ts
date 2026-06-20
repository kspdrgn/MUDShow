const DEFAULT_PROXY_URL = 'ws://127.0.0.1:8080';

type RuntimeWindow = Window & {
  __MUDSHOW_PROXY_URL__?: string;
};

function getConfiguredProxyUrl(): string {
  const envUrl = import.meta.env.VITE_MUDSHOW_PROXY_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    const runtimeWindow = window as RuntimeWindow;
    const windowUrl = runtimeWindow.__MUDSHOW_PROXY_URL__?.trim();
    if (windowUrl) {
      return windowUrl;
    }
  }

  return DEFAULT_PROXY_URL;
}

function normalizeWebSocketUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  if (url.protocol === 'http:') {
    url.protocol = 'ws:';
  } else if (url.protocol === 'https:') {
    url.protocol = 'wss:';
  }

  return url.toString();
}

export function buildProxyWebSocketUrl(host: string, port: number, tls: boolean): string {
  const url = new URL(normalizeWebSocketUrl(getConfiguredProxyUrl()));
  url.searchParams.set('host', host);
  url.searchParams.set('port', String(port));
  url.searchParams.set('tls', String(tls));
  return url.toString();
}
