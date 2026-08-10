import { afterEach, describe, expect, it, vi } from "vitest";

import { formatTimeAgo } from "./utils";

const NOW = new Date("2026-08-10T13:30:00Z");

function ago(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("formatTimeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function at(date: Date): string {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    return formatTimeAgo(date);
  }

  it("collapses anything under a minute", () => {
    expect(at(ago(5))).toBe("just now");
    expect(at(ago(59))).toBe("just now");
  });

  it("steps up through each unit at the right boundary", () => {
    expect(at(ago(MINUTE))).toBe("1 minute ago");
    expect(at(ago(45 * MINUTE))).toBe("45 minutes ago");
    expect(at(ago(HOUR))).toBe("1 hour ago");
    expect(at(ago(5 * HOUR))).toBe("5 hours ago");
    expect(at(ago(DAY))).toBe("1 day ago");
    expect(at(ago(3 * DAY))).toBe("3 days ago");
    expect(at(ago(9 * DAY))).toBe("1 week ago");
    expect(at(ago(60 * DAY))).toBe("2 months ago");
    expect(at(ago(400 * DAY))).toBe("1 year ago");
  });

  it("reports a fortnight-old delivery in weeks, not months", () => {
    // Regression: a miscascaded divisor turned 13 days into ~26 weeks.
    expect(at(new Date("2026-07-28T18:41:54Z"))).toBe("2 weeks ago");
  });
});
