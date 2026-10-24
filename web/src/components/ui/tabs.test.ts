import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

describe("Tabs primitive component", () => {
  it("renders active and inactive tabs with default pill variant", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Tabs,
        { defaultValue: "tab1" },
        React.createElement(
          TabsList,
          null,
          React.createElement(TabsTrigger, { value: "tab1" }, "Tab 1"),
          React.createElement(TabsTrigger, { value: "tab2" }, "Tab 2")
        ),
        React.createElement(TabsContent, { value: "tab1", className: "flex p-4" }, "Content 1"),
        React.createElement(TabsContent, { value: "tab2", className: "flex p-4" }, "Content 2")
      )
    );

    // Active tab panel must NOT be hidden
    assert.match(html, /data-state="active"/);
    assert.match(html, /Content 1/);

    // Inactive tab panel must have data-[state=inactive]:hidden! class and hidden attribute
    assert.match(html, /data-\[state=inactive\]:!hidden/);
    assert.match(html, /data-slot="tabs-content"/);
    assert.match(html, /data-slot="tabs-trigger"/);
    assert.match(html, /cursor-pointer/);
    assert.match(html, /rounded-control/);
  });

  it("renders line variant with underline styling when variant='line'", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        Tabs,
        { defaultValue: "overview", variant: "line" },
        React.createElement(
          TabsList,
          null,
          React.createElement(TabsTrigger, { value: "overview" }, "Overview"),
          React.createElement(TabsTrigger, { value: "stack" }, "Stack")
        ),
        React.createElement(TabsContent, { value: "overview" }, "Overview panel"),
        React.createElement(TabsContent, { value: "stack" }, "Stack panel")
      )
    );

    assert.match(html, /border-b-2/);
    assert.match(html, /data-\[state=active\]:border-accent/);
    assert.match(html, /bg-transparent/);
  });
});
