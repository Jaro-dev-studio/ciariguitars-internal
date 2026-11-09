import { describe, expect, it } from "vitest";
import { withLinkSwitched } from "./reverb-link";

const now = new Date("2026-11-09T12:00:00Z");

describe("withLinkSwitched", () => {
  it("restarts the order cutover when switched on", () => {
    const config = withLinkSwitched(
      { ordersLiveSince: "2026-10-01T00:00:00.000Z", other: "kept" },
      true,
      "chase@ciariguitars.com",
      now
    );
    expect(config).toEqual({
      ordersLiveSince: "2026-11-09T12:00:00.000Z",
      other: "kept",
      liveSync: true,
      liveSyncChangedAt: "2026-11-09T12:00:00.000Z",
      liveSyncChangedBy: "chase@ciariguitars.com",
    });
  });

  it("keeps the cutover when switched on again while already on", () => {
    const config = withLinkSwitched(
      { liveSync: true, ordersLiveSince: "2026-10-01T00:00:00.000Z" },
      true,
      "me@jaro.dev",
      now
    );
    expect(config.ordersLiveSince).toBe("2026-10-01T00:00:00.000Z");
  });

  it("keeps the cutover when switched off", () => {
    const config = withLinkSwitched(
      { liveSync: true, ordersLiveSince: "2026-10-01T00:00:00.000Z" },
      false,
      "me@jaro.dev",
      now
    );
    expect(config.liveSync).toBe(false);
    expect(config.ordersLiveSince).toBe("2026-10-01T00:00:00.000Z");
  });
});
