// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScheduleAutoUnblockController } from "../ui/blocked/utils/scheduleAutoUnblock";

type ChromeRuntimeMock = {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>;
  };
};

function setChromeMock(sendMessage: ChromeRuntimeMock["runtime"]["sendMessage"]) {
  (globalThis as unknown as { chrome: ChromeRuntimeMock }).chrome = {
    runtime: { sendMessage },
  };
}

describe("schedule auto-unblock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T10:00:00Z"));
    window.history.pushState({}, "", "/blocked.html");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    // cleanup chrome mock
    delete (globalThis as Record<string, unknown>).chrome;
  });

  it("redirects when timeline turns free", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      timeline: { state: "free" },
    });
    setChromeMock(sendMessage);
    const resolveBlockedUrl = vi.fn().mockResolvedValue("https://youtube.com/");

    const controller = createScheduleAutoUnblockController({ resolveBlockedUrl });
    controller.setEnabled(true);
    controller.start();

    await vi.advanceTimersByTimeAsync(15000);

    expect(sendMessage).toHaveBeenCalled();
    expect(resolveBlockedUrl).toHaveBeenCalled();
  });

  it("does nothing when disabled", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      timeline: { state: "free" },
    });
    setChromeMock(sendMessage);
    const resolveBlockedUrl = vi.fn().mockResolvedValue("https://youtube.com/");

    const controller = createScheduleAutoUnblockController({ resolveBlockedUrl });
    controller.setEnabled(false);
    controller.start();

    await vi.advanceTimersByTimeAsync(15000);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(window.location.href).toContain("blocked.html");
  });

  it("keeps the user on the blocked page while still blocked", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      timeline: { state: "blocked" },
    });
    setChromeMock(sendMessage);
    const resolveBlockedUrl = vi.fn().mockResolvedValue("https://youtube.com/");

    const controller = createScheduleAutoUnblockController({ resolveBlockedUrl });
    controller.setEnabled(true);
    controller.start();

    await vi.advanceTimersByTimeAsync(15000);

    expect(sendMessage).toHaveBeenCalled();
    expect(window.location.href).toContain("blocked.html");
  });
});
