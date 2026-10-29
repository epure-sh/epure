/// <reference types="vite/client" />

declare module "virtual:stylex:css-only" {
  const css: string;
  export default css;
}

declare module "virtual:stylex:runtime" {
  const runtime: unknown;
  export default runtime;
}
