import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  getStoredThemeMode,
  applyThemeMode,
  toggleThemeMode,
  getThemeMode,
  initStyleTheme,
  getStoredStyleTheme,
  applyStyleTheme,
} from "./style-theme";

describe("style-theme & dark theme mode", () => {
  // Mock mock document & localStorage in node environment if needed
  beforeEach(() => {
    const store = new Map<string, string>();
    const classList = new Set<string>();
    const attributes = new Map<string, string>();

    globalThis.localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, String(val));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      length: 0,
      key: () => null,
    } as unknown as Storage;

    (globalThis as any).document = {
      documentElement: {
        classList: {
          add: (cls: string) => classList.add(cls),
          remove: (cls: string) => classList.delete(cls),
          contains: (cls: string) => classList.has(cls),
        },
        setAttribute: (attr: string, val: string) => attributes.set(attr, val),
        getAttribute: (attr: string) => attributes.get(attr) ?? null,
        removeAttribute: (attr: string) => attributes.delete(attr),
      },
    };
  });

  it("defaults to dark theme mode when nothing is stored", () => {
    assert.equal(getStoredThemeMode(), "dark");
    assert.equal(getThemeMode(), "dark");
  });

  it("applies dark mode cleanly to root classes and attributes", () => {
    applyThemeMode("dark");
    assert.equal(document.documentElement.classList.contains("dark"), true);
    assert.equal(document.documentElement.classList.contains("light"), false);
    assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
    assert.equal(localStorage.getItem("epure-theme-mode"), "dark");
    assert.equal(getThemeMode(), "dark");
  });

  it("applies light mode cleanly when toggled", () => {
    applyThemeMode("light");
    assert.equal(document.documentElement.classList.contains("dark"), false);
    assert.equal(document.documentElement.classList.contains("light"), true);
    assert.equal(document.documentElement.getAttribute("data-theme"), "light");
    assert.equal(localStorage.getItem("epure-theme-mode"), "light");
    assert.equal(getThemeMode(), "light");
  });

  it("toggles between dark and light themes smoothly", () => {
    applyThemeMode("dark");
    const next1 = toggleThemeMode();
    assert.equal(next1, "light");
    assert.equal(getThemeMode(), "light");

    const next2 = toggleThemeMode();
    assert.equal(next2, "dark");
    assert.equal(getThemeMode(), "dark");
  });

  it("initStyleTheme initializes both data-style and theme mode", () => {
    localStorage.setItem("epure-theme-mode", "dark");
    localStorage.setItem("epure-style-theme", "calm-ledger");

    initStyleTheme();
    assert.equal(document.documentElement.getAttribute("data-style"), "calm-ledger");
    assert.equal(document.documentElement.classList.contains("dark"), true);
    assert.equal(document.documentElement.getAttribute("data-theme"), "dark");
  });
});
