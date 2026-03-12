import { installMockApi } from "./mock-api";
import { initStyleTheme } from "../src/lib/style-theme";

installMockApi();
initStyleTheme();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@design/tokens.css";
import "../src/app.css";
import { PlaygroundApp } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlaygroundApp />
  </StrictMode>,
);
