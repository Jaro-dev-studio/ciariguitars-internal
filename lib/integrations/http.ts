import "server-only";

/**
 * Shared fetch wrapper for the platform API clients. Reverb and Katana both
 * throw the occasional gateway-level blip (502/503/504) and rate-limit
 * response, which used to fail a whole sync item and raise an alert for what
 * is really a one-off hiccup. Transient responses are retried with exponential
 * backoff + jitter so only genuinely persistent failures surface.
 */

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Only methods that are safe to repeat - a retried POST could double-write. */
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE"]);

export interface RetryOptions {
  /** Total attempts, including the first one. */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Human-readable request name used in logs, e.g. "Reverb GET /my/listings". */
  label?: string;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {}
): Promise<Response> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    label = url,
  } = options;

  const method = (init.method ?? "GET").toUpperCase();
  const isRetryable = IDEMPOTENT_METHODS.has(method);

  for (let attempt = 1; ; attempt++) {
    const isLastAttempt = attempt >= maxAttempts;

    try {
      const response = await fetch(url, init);

      if (
        response.ok ||
        !isRetryable ||
        isLastAttempt ||
        !RETRYABLE_STATUSES.has(response.status)
      ) {
        return response;
      }

      // Release the socket - the body is discarded since we are retrying.
      void response.body?.cancel().catch(() => {});

      const delayMs = resolveDelay(response, attempt, baseDelayMs, maxDelayMs);
      console.warn(
        `[IntegrationHttp] ${label} returned ${response.status} (transient), retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`
      );
      await sleep(delayMs);
    } catch (err) {
      // Network-level failure: DNS, socket reset, connection timeout.
      const isAborted =
        init.signal?.aborted || (err instanceof Error && err.name === "AbortError");
      if (!isRetryable || isLastAttempt || isAborted) throw err;

      const delayMs = backoff(attempt, baseDelayMs, maxDelayMs);
      console.warn(
        `[IntegrationHttp] ${label} threw "${err instanceof Error ? err.message : String(err)}", retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`
      );
      await sleep(delayMs);
    }
  }
}

/** Honours Retry-After when the server sends it, otherwise plain backoff. */
function resolveDelay(
  response: Response,
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const ms = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(ms) && ms > 0) return Math.min(ms, maxDelayMs);
  }
  return backoff(attempt, baseDelayMs, maxDelayMs);
}

function backoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
  // Jitter keeps a batch of concurrent items from retrying in lockstep.
  return Math.round(exponential * (0.5 + Math.random() * 0.5));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
