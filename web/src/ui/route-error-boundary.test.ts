import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorState } from "./error-state";
import { RouteErrorBoundary } from "./route-error-boundary";
import { useAppContext } from "../shell/app-context";
import { useToast } from "./toast-provider";

describe("RouteErrorBoundary and ErrorState", () => {
  it("renders children when no error is caught", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        RouteErrorBoundary,
        { title: "Test Error" },
        React.createElement("div", { id: "child-content" }, "Healthy Child Content")
      )
    );

    assert.match(html, /Healthy Child Content/);
    assert.doesNotMatch(html, /Test Error/);
  });

  it("renders ErrorState with reload button and collapsible error stack", () => {
    const dummyError = new Error("Database connection timed out");
    const dummyStack = "Error: Database connection timed out\n    at query (db.ts:42)";

    const html = renderToStaticMarkup(
      React.createElement(ErrorState, {
        title: "Critical View Failure",
        description: "Something went wrong loading this tab.",
        error: dummyError,
        stack: dummyStack,
        showReload: true,
      })
    );

    assert.match(html, /Critical View Failure/);
    assert.match(html, /Something went wrong loading this tab\./);
    assert.match(html, /Reload page/);
    assert.match(html, /Database connection timed out/);
    assert.match(html, /db\.ts:42/);
    assert.match(html, /<details/);
  });

  it("renders ErrorState with backHref safely outside BrowserRouter using anchor tag", () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorState, {
        title: "Router-Free Crash",
        backHref: "/safe-fallback",
        backLabel: "Return Home",
      })
    );

    assert.match(html, /Router-Free Crash/);
    assert.match(html, /<a[^>]*href="\/safe-fallback"[^>]*>Return Home<\/a>/);
  });
});

describe("Context Fallback Resilience", () => {
  it("useAppContext does not throw when evaluated outside AppProvider and includes userLoading", () => {
    function TestConsumer() {
      const ctx = useAppContext();
      return React.createElement(
        "div",
        null,
        `env:${ctx.environment},projects:${ctx.projects.length},loading:${ctx.projectsLoading},userLoading:${ctx.userLoading}`
      );
    }

    const html = renderToStaticMarkup(React.createElement(TestConsumer));
    assert.match(html, /env:production,projects:0,loading:false,userLoading:false/);
  });

  it("useToast does not throw when evaluated outside ToastProvider", () => {
    function ToastConsumer() {
      const { toast } = useToast();
      toast("Test toast outside provider");
      return React.createElement("div", null, "Toast Invoked Safely");
    }

    const html = renderToStaticMarkup(React.createElement(ToastConsumer));
    assert.match(html, /Toast Invoked Safely/);
  });
});
