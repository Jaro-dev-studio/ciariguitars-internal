import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithRetry } from "./http";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetch(responses: Array<Response | Error>) {
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next instanceof Error) throw next;
    return next;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

const fast = { baseDelayMs: 1, maxDelayMs: 2 };

describe("fetchWithRetry", () => {
  it("retries a transient 502 and returns the eventual success", async () => {
    const fetchMock = mockFetch([
      new Response("{}", { status: 502 }),
      new Response("{\"ok\":true}", { status: 200 }),
    ]);

    const response = await fetchWithRetry("https://api.reverb.com/api/my/listings", {}, fast);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries network-level failures", async () => {
    const fetchMock = mockFetch([
      new Error("socket hang up"),
      new Response("{}", { status: 200 }),
    ]);

    const response = await fetchWithRetry("https://api.reverb.com/api/my/listings", {}, fast);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts and returns the last failing response", async () => {
    const fetchMock = mockFetch([
      new Response("{}", { status: 502 }),
      new Response("{}", { status: 502 }),
      new Response("{}", { status: 502 }),
    ]);

    const response = await fetchWithRetry(
      "https://api.reverb.com/api/my/listings",
      {},
      { ...fast, maxAttempts: 3 }
    );

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry client errors such as 404", async () => {
    const fetchMock = mockFetch([new Response("{}", { status: 404 })]);

    const response = await fetchWithRetry("https://api.reverb.com/api/listings/1", {}, fast);

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-idempotent methods", async () => {
    const fetchMock = mockFetch([new Response("{}", { status: 503 })]);

    const response = await fetchWithRetry(
      "https://api.reverb.com/api/webhooks/registrations",
      { method: "POST" },
      fast
    );

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("honours a Retry-After header, capped at maxDelayMs", async () => {
    mockFetch([
      new Response("{}", { status: 429, headers: { "retry-after": "600" } }),
      new Response("{}", { status: 200 }),
    ]);

    const startedAt = Date.now();
    const response = await fetchWithRetry(
      "https://api.reverb.com/api/my/listings",
      {},
      { baseDelayMs: 1, maxDelayMs: 20 }
    );

    expect(response.status).toBe(200);
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});
