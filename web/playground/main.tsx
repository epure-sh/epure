import { installMockApi } from "./mock-api";
import { initStyleTheme } from "../src/lib/style-theme";

installMockApi();
initStyleTheme();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@design/tokens.css";
import "../src/styles/tokens.css";
import "../src/app.css";
import { PlaygroundApp } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlaygroundApp />
  </StrictMode>,
);
