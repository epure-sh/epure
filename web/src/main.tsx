import { initStyleTheme } from "./lib/style-theme";

initStyleTheme();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@design/tokens.css";
import "./app.css";
import { App } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
