import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError, apiErrorMessage, apiErrorStatus, isApiError } from "./api-error";

describe("api-error", () => {
  it("reads status from ApiError", () => {
    const error = new ApiError(404, "/api/v1/issues");
    assert.equal(apiErrorStatus(error), 404);
    assert.equal(isApiError(error, 404), true);
    assert.equal(isApiError(error, 403), false);
  });

  it("reads status from legacy error messages", () => {
    const error = new Error("API 500: /api/v1/projects");
    assert.equal(apiErrorStatus(error), 500);
  });

  it("maps common statuses to friendly copy", () => {
    assert.equal(
      apiErrorMessage(new ApiError(403, "/x")),
      "You do not have permission to view this.",
    );
    assert.equal(
      apiErrorMessage(new ApiError(404, "/x")),
      "The requested resource was not found.",
    );
    assert.equal(
      apiErrorMessage(new Error("Failed to fetch")),
      "Network error — check your connection and try again.",
    );
  });
});
