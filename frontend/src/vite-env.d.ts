/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MUDSHOW_PROXY_URL?: string;
}

interface Window {
  __MUDSHOW_PROXY_URL__?: string;
}

