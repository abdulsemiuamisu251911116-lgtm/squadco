import { serverEnv } from "./env";
import { captureException, captureMessage } from "./monitoring";

type CircuitState = "closed" | "open" | "half-open";

let circuitState: CircuitState = "closed";
let failureCount = 0;
let openedAt = 0;

function shouldAllowRequest() {
  if (circuitState === "closed") return true;
  if (Date.now() - openedAt > 30_000) {
    circuitState = "half-open";
    return true;
  }
  return false;
}

function recordSuccess() {
  if (circuitState !== "closed") {
    void captureMessage("AI engine circuit closed", "info", { previousState: circuitState });
  }
  failureCount = 0;
  circuitState = "closed";
}

function recordFailure() {
  failureCount += 1;
  if (failureCount >= 5 && circuitState !== "open") {
    circuitState = "open";
    openedAt = Date.now();
    void captureMessage("AI engine circuit opened", "error", { failureCount });
  }
}

async function post<T>(path: string, payload: unknown, options?: { timeoutMs?: number; retryOnce?: boolean; requestId?: string }) {
  if (!shouldAllowRequest()) {
    throw new Error("AI engine circuit open");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 8000);

  try {
    const response = await fetch(`${serverEnv.aiEngineUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": serverEnv.aiEngineSecret,
        ...(options?.requestId ? { "x-request-id": options.requestId } : {})
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store"
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if ((response.status >= 500 || response.status === 429) && options?.retryOnce) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return post<T>(path, payload, { ...options, retryOnce: false });
      }
      recordFailure();
      throw new Error(`AI engine error: ${response.status}`);
    }

    recordSuccess();
    return response.json() as Promise<T>;
  } catch (error) {
    clearTimeout(timeout);
    if (options?.retryOnce) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return post<T>(path, payload, { ...options, retryOnce: false });
    }
    recordFailure();
    void captureException(error, { path, requestId: options?.requestId });
    throw error;
  }
}

export const aiEngineService = {
  analyzeRisk: <T>(payload: unknown, requestId?: string) => post<T>("/analyze-risk", payload, { timeoutMs: 8000, retryOnce: true, requestId }),
  scoreCredit: <T>(payload: unknown, requestId?: string) => post<T>("/score-credit", payload, { timeoutMs: 15000, retryOnce: false, requestId }),
  parseStatement: <T>(payload: unknown, requestId?: string) => post<T>("/parse-statement", payload, { timeoutMs: 30000, retryOnce: true, requestId }),
  explain: <T>(payload: unknown, requestId?: string) => post<T>("/explain", payload, { timeoutMs: 10000, retryOnce: false, requestId }),
  predictBalance: <T>(payload: unknown, requestId?: string) => post<T>("/predict-balance", payload, { timeoutMs: 8000, retryOnce: true, requestId }),
  categorize: <T>(payload: unknown, requestId?: string) => post<T>("/categorize", payload, { timeoutMs: 5000, retryOnce: true, requestId })
};
