// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://www.youtube.com/watch?v=N2dqJG-e_Gw"}
import { beforeEach, describe, expect, it, vi } from "vitest";
import settingsFixture from "../../focus-tube-settings.json";
import { allowWhitelistedYouTubeWatchIfPossible } from "../content/youtubeWhitelist";

vi.mock("../infrastructure/storage", () => ({
  getSettings: vi.fn(async () => settingsFixture)
}));

function setChannelHandle(handle: string) {
  document.body.innerHTML = `
    <ytd-video-owner-renderer>
      <a href="/@${handle}">${handle}</a>
    </ytd-video-owner-renderer>
  `;
}

beforeEach(() => {
  document.body.innerHTML = "";
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
