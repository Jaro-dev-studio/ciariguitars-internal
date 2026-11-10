import { describe, expect, it } from "vitest";
import { withSwitchFlipped } from "./live-switch";

const now = new Date("2026-11-09T12:00:00Z");

describe("withSwitchFlipped", () => {
  it("restarts the cutover when switched on", () => {
    const config = withSwitchFlipped(
      { ordersLiveSince: "2026-10-01T00:00:00.000Z", other: "kept" },
      true,
      "chase@ciariguitars.com",
      now,
      "ordersLiveSince"
    );
    expect(config).toEqual({
      ordersLiveSince: "2026-11-09T12:00:00.000Z",
      other: "kept",
      liveSync: true,
      liveSyncChangedAt: "2026-11-09T12:00:00.000Z",
      liveSyncChangedBy: "chase@ciariguitars.com",
    });
  });

  it("stamps the cutover under the switch's own key", () => {
    const config = withSwitchFlipped({}, true, "me@jaro.dev", now, "bookingsLiveSince");
    expect(config.bookingsLiveSince).toBe("2026-11-09T12:00:00.000Z");
    expect(config.ordersLiveSince).toBeUndefined();
  });

  it("keeps the cutover when switched on again while already on", () => {
    const config = withSwitchFlipped(
      { liveSync: true, ordersLiveSince: "2026-10-01T00:00:00.000Z" },
      true,
      "me@jaro.dev",
      now,
      "ordersLiveSince"
    );
    expect(config.ordersLiveSince).toBe("2026-10-01T00:00:00.000Z");
  });

  it("keeps the cutover when switched off", () => {
    const config = withSwitchFlipped(
      { liveSync: true, ordersLiveSince: "2026-10-01T00:00:00.000Z" },
      false,
      "me@jaro.dev",
      now,
      "ordersLiveSince"
    );
    expect(config.liveSync).toBe(false);
    expect(config.ordersLiveSince).toBe("2026-10-01T00:00:00.000Z");
  });

  it("starts off when nothing has been stored", () => {
    const config = withSwitchFlipped({}, false, "me@jaro.dev", now, "ordersLiveSince");
    expect(config.liveSync).toBe(false);
    expect(config.ordersLiveSince).toBeUndefined();
  });
});
