import { installMockApi } from "./mock-api";
import { initStyleTheme } from "../src/lib/style-theme";

installMockApi();
initStyleTheme();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../src/styles/fonts.css";
import "@design/tokens.css";
import "../src/styles/tokens.css";
import "../src/styles/orbit-stylex.css";
import "../src/app.css";
import { PlaygroundApp } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlaygroundApp />
  </StrictMode>,
);
