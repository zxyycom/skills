import { JudgmentFailure } from "./failure.ts";
import type { Request } from "./request.ts";
import { validateResponse, type ValidatedResponse } from "./response.ts";
import type { ApiKey } from "./configuration.ts";

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export type TransportOptions = Readonly<{
  endpoint: string;
  body: string;
  apiKey: ApiKey;
  timeoutMs: number;
  received?: (status: number, body?: Uint8Array) => void;
}>;

type ResponseHead = Readonly<{
  status: number;
  failure: JudgmentFailure | undefined;
}>;

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

async function responseBytes(response: Response): Promise<Uint8Array> {
  try {
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new JudgmentFailure(
      "network",
      "响应正文读取失败；服务端可能已经处理请求。",
      response.status
    );
  }
}

function decodedBody(bytes: Uint8Array, status: number): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new JudgmentFailure(
      "invalid_response",
      "响应正文不是有效 UTF-8。",
      status
    );
  }
}

async function exchange(
  request: Request,
  options: TransportOptions,
  fetch: Fetch,
  signal: AbortSignal,
  received: (head: ResponseHead) => void
): Promise<ValidatedResponse> {
  let response: Response;
  try {
    response = await fetch(options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`
      },
      body: options.body,
      redirect: "manual",
      signal
    });
  } catch {
    throw new JudgmentFailure(
      "network",
      "请求连接失败；服务端是否完成处理未知。"
    );
  }
  signal.throwIfAborted();
  const failure = response.ok ? undefined : httpFailure(response);
  received({ status: response.status, failure });
  options.received?.(response.status);
  if (failure !== undefined && options.received === undefined) throw failure;
  let bytes: Uint8Array;
  try {
    bytes = await responseBytes(response);
  } catch (error) {
    throw failure ?? error;
  }
  signal.throwIfAborted();
  options.received?.(response.status, bytes);
  if (failure !== undefined) throw failure;
  const body = decodedBody(bytes, response.status);
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
  options: TransportOptions,
  fetch: Fetch
): Promise<ValidatedResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let head: ResponseHead | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        head?.failure ??
          new JudgmentFailure(
            "timeout",
            "请求等待超时；服务端是否完成处理未知。",
            head?.status ?? null
          )
      );
      controller.abort();
    }, options.timeoutMs);
  });
  try {
    return await Promise.race([
      exchange(request, options, fetch, controller.signal, (received) => {
        head = received;
      }),
      timeout
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
