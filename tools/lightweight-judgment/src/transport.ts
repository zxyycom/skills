import { JudgmentFailure } from "./failure.ts";
import { endpoint, type Request } from "./request.ts";
import { validateResponse } from "./response.ts";
import { stringifyJson, type JsonValue } from "./json.ts";

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

function retryAfter(value: string | null, now: number): number | undefined {
  if (value === null) {
    return undefined;
  }
  let milliseconds: number;
  if (/^\d+(?:\.\d+)?$/u.test(value)) {
    milliseconds = Number(value) * 1000;
  } else milliseconds = Date.parse(value) - now;
  if (!Number.isFinite(milliseconds)) {
    return undefined;
  }
  if (milliseconds < 0 || milliseconds > Number.MAX_SAFE_INTEGER) {
    return undefined;
  }
  return Math.ceil(milliseconds);
}

function httpFailure(response: Response): JudgmentFailure {
  let kind: "authentication" | "rate_limit" | "http" = "http";
  if ([401, 403].includes(response.status)) {
    kind = "authentication";
  }
  if (response.status === 429) {
    kind = "rate_limit";
  }
  return new JudgmentFailure(
    kind,
    `服务返回 HTTP ${response.status}；请核对凭据、预算或服务状态。`,
    response.status,
    retryAfter(response.headers.get("retry-after"), Date.now())
  );
}

async function decodedBody(response: Response): Promise<string> {
  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    throw new JudgmentFailure(
      "network",
      "响应正文读取失败；服务端可能已经处理请求。",
      response.status
    );
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new JudgmentFailure(
      "invalid_response",
      "响应正文不是有效 UTF-8。",
      response.status
    );
  }
}

async function exchange(
  request: Request,
  apiKey: string,
  fetch: Fetch,
  signal: AbortSignal,
  received: (status: number) => void
): Promise<JsonValue> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: stringifyJson(request),
      redirect: "manual",
      signal
    });
  } catch {
    throw new JudgmentFailure(
      "network",
      "请求连接失败；服务端是否完成处理未知。"
    );
  }
  received(response.status);
  if (!response.ok) {
    throw httpFailure(response);
  }
  const body = await decodedBody(response);
  try {
    return validateResponse(body, request);
  } catch (error) {
    if (error instanceof JudgmentFailure && error.validation !== undefined) {
      // validateResponse supplies fixed protocol paths and ordinals, never remote keys or IDs.
      const diagnostic = error.validation;
      throw new JudgmentFailure(
        "invalid_response",
        `${diagnostic.location}: ${diagnostic.reason}`,
        response.status,
        undefined,
        diagnostic
      );
    }
    throw error;
  }
}

export async function sendRequest(
  request: Request,
  apiKey: string,
  timeoutMs: number,
  fetch: Fetch
): Promise<JsonValue> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let status: number | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new JudgmentFailure(
          "timeout",
          "请求等待超时；服务端是否完成处理未知。",
          status
        )
      );
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      exchange(request, apiKey, fetch, controller.signal, (received) => {
        status = received;
      }),
      timeout
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
