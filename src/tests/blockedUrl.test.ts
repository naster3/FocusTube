// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getInitialBlockedUrl, matchBlockedDomain } from "../ui/blocked/utils/blockedUrl";

describe("blockedUrl helpers", () => {
  it("matches blocked domain ignoring www", () => {
    expect(matchBlockedDomain("https://www.youtube.com/watch?v=123", ["youtube.com"])).toBe("youtube.com");
    expect(matchBlockedDomain("https://m.youtube.com/watch?v=123", ["youtube.com"])).toBe("youtube.com");
  });

  it("returns null when no match", () => {
    expect(matchBlockedDomain("https://example.com", ["youtube.com"])).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(matchBlockedDomain("not a url", ["youtube.com"])).toBeNull();
  });

  it("reads blocked url from query string", () => {
    const original = window.location.href;
    window.history.pushState({}, "", "https://example.com/blocked.html?url=https%3A%2F%2Fyoutube.com%2F");
    expect(getInitialBlockedUrl()).toBe("https://youtube.com/");
    window.history.pushState({}, "", original);
  });
});
