// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.youtube.com/watch?v=N2dqJG-e_Gw"}
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/settings/defaults";
import { allowWhitelistedYouTubeWatchIfPossible } from "../content/youtubeWhitelist";

const settingsFixture = {
  ...DEFAULT_SETTINGS,
  whitelistEnabled: true,
  whitelist: ["https://www.youtube.com/@veritasium"]
};

vi.mock("../infrastructure/storage", () => ({
  getSettings: vi.fn(async () => settingsFixture)
}));

const clearBody = () => {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
};

function setChannelHandle(handle: string) {
  clearBody();
  const renderer = document.createElement("ytd-video-owner-renderer");
  const link = document.createElement("a");
  link.setAttribute("href", `/@${handle}`);
  link.textContent = handle;
  renderer.appendChild(link);
  document.body.appendChild(renderer);
}

beforeEach(() => {
  clearBody();
  window.history.replaceState({}, "", "https://www.youtube.com/watch?v=N2dqJG-e_Gw");
});

describe("youtube whitelist", () => {
  it("allows watch when channel handle is in whitelist settings", async () => {
    setChannelHandle("veritasium");
    const allowed = await allowWhitelistedYouTubeWatchIfPossible();
    expect(allowed).toBe(true);
  });

  it("blocks watch when channel handle is not in whitelist settings", async () => {
    setChannelHandle("not-in-list");
    const allowed = await allowWhitelistedYouTubeWatchIfPossible();
    expect(allowed).toBe(false);
  });

  it("allows watch when ab_channel matches whitelist handle", async () => {
    window.history.replaceState({}, "", "https://www.youtube.com/watch?v=N2dqJG-e_Gw&ab_channel=veritasium");
    const allowed = await allowWhitelistedYouTubeWatchIfPossible();
    expect(allowed).toBe(true);
  });
});
