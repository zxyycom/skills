import { inspect } from "node:util";

const operationErrorDetailMaximumLength = 500;
const redactedDetail = "[redacted]";

const credentialedUrlPattern =
  /(?<scheme>https?|ssh):\/\/[^\s/@]+(?::[^\s/@]*)?@(?<host>[^\s/]+)/giu;
const namedSecretPattern =
  /\b(?<name>access[ _-]?token|authorization|password|secret|token)\s*[:=][^,;]*/giu;
const providerTokenPattern =
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu;
const absolutePathPattern =
  /(?:\b[A-Za-z]:[\\/][^,;\r\n]*|(?<![A-Za-z0-9_.:/-])\/[^,;\r\n]*)/gu;

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
  const sanitized = text
    .replace(
      credentialedUrlPattern,
      "$<scheme>://" + redactedDetail + "@$<host>"
    )
    .replace(namedSecretPattern, "$<name>=" + redactedDetail)
    .replace(providerTokenPattern, redactedDetail)
    .replace(absolutePathPattern, redactedDetail);
  return sanitized.length <= operationErrorDetailMaximumLength
    ? sanitized
    : sanitized.slice(0, operationErrorDetailMaximumLength - 1) + "…";
}
