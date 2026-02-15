/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module "*.css";
declare module "*.css?raw";
declare module "*.wasm?url";

interface ImportMetaEnv {
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
