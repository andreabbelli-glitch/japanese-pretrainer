export type FetchThrottleConfig = {
  maxRetries?: number;
  requestDelayMs: number;
  requestTimeoutMs?: number;
  retryBaseDelayMs?: number;
};

type FetchRetryHooks = {
  onResponseRetry?: (input: {
    response: Response;
    retryDelayMs: number;
    url: string;
  }) => void;
};

type FetchOverrideConfig = Partial<FetchThrottleConfig>;

export function createFetchThrottle(
  config: FetchThrottleConfig,
  hooks: FetchRetryHooks = {}
) {
  let nextAllowedAt = 0;

  async function throttledFetch(
    url: string,
    init?: RequestInit,
    override?: FetchOverrideConfig
  ): Promise<Response> {
    const resolvedConfig = resolveConfig(config, override);
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedAt - now);

    if (waitMs > 0) {
      await sleep(waitMs);
    }

    nextAllowedAt = Date.now() + Math.max(0, resolvedConfig.requestDelayMs);

    const timeoutController = new AbortController();
    const timeout = setTimeout(() => {
      timeoutController.abort();
    }, resolvedConfig.requestTimeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: init?.signal
          ? AbortSignal.any([init.signal, timeoutController.signal])
          : timeoutController.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchWithRetry(
    url: string,
    init?: RequestInit,
    override?: FetchOverrideConfig
  ): Promise<Response> {
    const resolvedConfig = resolveConfig(config, override);

    for (let attempt = 0; attempt <= resolvedConfig.maxRetries; attempt += 1) {
      let response: Response;

      try {
        response = await throttledFetch(url, init, resolvedConfig);
      } catch (error) {
        if (attempt < resolvedConfig.maxRetries) {
          await sleep(resolvedConfig.retryBaseDelayMs * 2 ** attempt);
          continue;
        }

        throw new Error(
          `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (response.ok) {
        return response;
      }

      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < resolvedConfig.maxRetries
      ) {
        const retryDelayMs =
          parseRetryAfterMs(response.headers.get("retry-after")) ??
          resolvedConfig.retryBaseDelayMs * 2 ** attempt;

        hooks.onResponseRetry?.({
          response,
          retryDelayMs,
          url
        });
        await cancelResponseBody(response);
        await sleep(retryDelayMs);
        continue;
      }

      await cancelResponseBody(response);
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
    }

    throw new Error(`Failed to fetch ${url}: exhausted retries`);
  }

  return { fetchWithRetry, throttledFetch };
}

async function cancelResponseBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Best effort: body cleanup should not mask the original retry path.
  }
}

export function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const asSeconds =
    /^[0-9]+$/.test(trimmed) ? Number.parseInt(trimmed, 10) : Number.NaN;

  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const retryAt = Date.parse(trimmed);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function resolveConfig(
  config: FetchThrottleConfig,
  override?: FetchOverrideConfig
) {
  return {
    maxRetries: override?.maxRetries ?? config.maxRetries ?? 4,
    requestDelayMs: override?.requestDelayMs ?? config.requestDelayMs,
    requestTimeoutMs:
      override?.requestTimeoutMs ?? config.requestTimeoutMs ?? 15_000,
    retryBaseDelayMs:
      override?.retryBaseDelayMs ?? config.retryBaseDelayMs ?? 5000
  };
}

export async function sleep(durationMs: number) {
  if (durationMs <= 0) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, durationMs));
}
