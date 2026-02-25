// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { getBlockedElements } from "../ui/blocked/utils/dom";

describe("blocked DOM mapping", () => {
  it("returns references for known elements", () => {
    const elementsToCreate: Array<{ id: string; tag: string }> = [
      { id: "message", tag: "div" },
      { id: "attempts", tag: "div" },
      { id: "last-attempt", tag: "div" },
      { id: "blocked-url", tag: "div" },
      { id: "blocked-url-label", tag: "div" },
      { id: "copy-url-btn", tag: "button" },
      { id: "unblock-btn", tag: "button" },
      { id: "close-btn", tag: "button" },
      { id: "blocked-tag", tag: "div" },
      { id: "blocked-title", tag: "div" },
      { id: "attempts-label", tag: "div" },
      { id: "last-attempt-label", tag: "div" },
      { id: "blocked-reason-label", tag: "div" },
      { id: "blocked-reason", tag: "div" },
    ];

    elementsToCreate.forEach(({ id, tag }) => {
      const el = document.createElement(tag);
      el.id = id;
      document.body.appendChild(el);
    });

    const elements = getBlockedElements();
    expect(elements.messageEl).toBeInstanceOf(HTMLElement);
    expect(elements.attemptsEl).toBeInstanceOf(HTMLElement);
    expect(elements.copyUrlBtn).toBeInstanceOf(HTMLButtonElement);
    expect(elements.unblockBtn).toBeInstanceOf(HTMLButtonElement);
    expect(elements.closeBtn).toBeInstanceOf(HTMLButtonElement);
  });
});
