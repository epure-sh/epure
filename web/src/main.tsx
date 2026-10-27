import { initStyleTheme } from "./lib/style-theme";

initStyleTheme();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@design/tokens.css";
import "./styles/tokens.css";
import "./app.css";
import { App } from "./app";
import { RouteErrorBoundary } from "./ui/route-error-boundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouteErrorBoundary title="Application failed to start">
      <App />
    </RouteErrorBoundary>
  </StrictMode>,
);
