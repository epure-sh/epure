import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_QUERY,
  extractChips,
  getEnvironmentFilter,
  getFilterPresetLabel,
  getLevelFilter,
  getSearchText,
  hasActiveFilters,
  parseQuery,
  resetQuery,
  setEnvironmentFilter,
  setLevelFilter,
  toggleToken,
  withSearchText,
} from "./query-utils";

describe("query-utils pre-filters & parsing", () => {
  it("parses structured tokens and free text accurately", () => {
    const parsed = parseQuery("is:unresolved level:error env:production user.email:alice@example.com TypeError");
    assert.equal(parsed.status, "unresolved");
    assert.equal(parsed.level, "error");
    assert.equal(parsed.environment, "production");
    assert.equal(parsed.userEmail, "alice@example.com");
    assert.equal(parsed.freeText, "TypeError");
  });

  it("extracts chips for search omnibar visualization", () => {
    const chips = extractChips("is:unresolved level:fatal env:production user.email:@");
    assert.equal(chips.length, 4);

    const statusChip = chips.find((c) => c.key === "is");
    assert.ok(statusChip);
    assert.equal(statusChip?.label, "Unresolved");
    assert.equal(statusChip?.plain, true);

    const levelChip = chips.find((c) => c.key === "level");
    assert.ok(levelChip);
    assert.equal(levelChip?.label, "Fatal");

    const envChip = chips.find((c) => c.key === "env");
    assert.ok(envChip);
    assert.equal(envChip?.label, "Production");

    const userChip = chips.find((c) => c.key === "user");
    assert.ok(userChip);
    assert.equal(userChip?.label, "Users");
  });

  it("gets and sets severity level filters", () => {
    let query = "is:unresolved";
    assert.equal(getLevelFilter(query), null);

    query = setLevelFilter(query, "error");
    assert.equal(getLevelFilter(query), "error");
    assert.ok(query.includes("level:error"));

    // Changing level replaces existing level token
    query = setLevelFilter(query, "fatal");
    assert.equal(getLevelFilter(query), "fatal");
    assert.ok(!query.includes("level:error"));
    assert.ok(query.includes("level:fatal"));

    // Clearing level removes level token
    query = setLevelFilter(query, null);
    assert.equal(getLevelFilter(query), null);
    assert.ok(!query.includes("level:"));
  });

  it("gets and sets environment filters", () => {
    let query = "is:unresolved";
    assert.equal(getEnvironmentFilter(query), null);

    query = setEnvironmentFilter(query, "staging");
    assert.equal(getEnvironmentFilter(query), "staging");
    assert.ok(query.includes("env:staging"));

    query = setEnvironmentFilter(query, null);
    assert.equal(getEnvironmentFilter(query), null);
    assert.ok(!query.includes("env:"));
  });

  it("toggles tokens smoothly", () => {
    let query = "is:unresolved";
    query = toggleToken(query, "env:production");
    assert.ok(query.includes("env:production"));

    // Toggling again removes it
    query = toggleToken(query, "env:production");
    assert.ok(!query.includes("env:production"));
  });

  it("detects customized active filters vs default query", () => {
    assert.equal(hasActiveFilters(DEFAULT_QUERY), false);
    assert.equal(hasActiveFilters("is:unresolved"), false);
    assert.equal(hasActiveFilters("is:unresolved level:error"), true);
    assert.equal(hasActiveFilters("is:regression"), true);
    assert.equal(hasActiveFilters("is:unresolved env:staging"), true);
  });

  it("resets query to default unresolved status", () => {
    assert.equal(resetQuery(), "is:unresolved");
  });

  it("looks up labels for presets", () => {
    assert.equal(getFilterPresetLabel("level:fatal"), "Fatal");
    assert.equal(getFilterPresetLabel("level:error"), "Error");
    assert.equal(getFilterPresetLabel("env:production"), "Production");
    assert.equal(getFilterPresetLabel("user.email:@"), "Affecting Users");
    assert.equal(getFilterPresetLabel("custom:value"), "value");
  });
});

describe("query-utils search text", () => {
  it("keeps filter tokens when replacing the search text", () => {
    assert.equal(withSearchText("is:resolved level:error", "Type Error"), "is:resolved level:error Type Error");
    assert.equal(withSearchText("is:resolved old text", "new"), "is:resolved new");
  });

  it("does not fall back to is:unresolved when the search is cleared", () => {
    assert.equal(withSearchText("is:resolved foo", ""), "is:resolved");
    assert.equal(withSearchText("foo", ""), "");
  });

  it("extracts only the free text", () => {
    assert.equal(getSearchText("is:unresolved TypeError env:prod in checkout"), "TypeError in checkout");
    assert.equal(getSearchText("is:unresolved"), "");
  });
});
