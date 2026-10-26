/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EPURE_PLAYGROUND?: string;
  readonly VITE_EPURE_CLOUD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "@design/tokens.css";
