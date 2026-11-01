import { register } from "node:module";
import * as React from "react";

globalThis.React = React;

register(new URL("./stylex-test-hook.mjs", import.meta.url).href, import.meta.url);
