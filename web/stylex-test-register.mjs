import { register } from "node:module";

register(new URL("./stylex-test-hook.mjs", import.meta.url).href, import.meta.url);
