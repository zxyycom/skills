import { inspect } from "node:util";

const operationErrorDetailMaximumLength = 500;

export function operationErrorDetail(detail: unknown): string | null {
  if (detail === undefined || detail === null) {
    return null;
  }
  const text = (
    detail instanceof Error
      ? detail.message
      : typeof detail === "string"
        ? detail
        : inspect(detail, {
            breakLength: Infinity,
            compact: true,
            customInspect: false,
            depth: 3
          })
  )
    .trim()
    .replace(/\s+/gu, " ");
  if (text.length === 0) {
    return null;
  }
  return text.length <= operationErrorDetailMaximumLength
    ? text
    : text.slice(0, operationErrorDetailMaximumLength - 1) + "…";
}
