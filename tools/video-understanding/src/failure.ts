import * as v from "valibot";

export const FailureSchema = v.strictObject({
  kind: v.picklist([
    "input",
    "environment",
    "protocol",
    "inconsistent",
    "process",
    "timeout",
    "cancelled",
    "program"
  ]),
  stage: v.picklist([
    "arguments",
    "input",
    "output",
    "runtime",
    "inspection",
    "subtitle-conversion",
    "subtitle-decoding",
    "audio-extraction",
    "asr",
    "hard-ocr",
    "ocr",
    "frames",
    "manifest",
    "verification",
    "read",
    "refine",
    "lock",
    "publish"
  ]),
  target: v.string(),
  reason: v.string(),
  action: v.string()
});
export type Failure = v.InferOutput<typeof FailureSchema>;
export type Stage = Failure["stage"];

export class VideoFailure extends Error {
  readonly failure: Failure;
  constructor(failure: Failure) {
    super(
      `${failure.kind} at ${failure.stage}: ${failure.reason}; target=${failure.target}; ${failure.action}`
    );
    this.failure = failure;
  }
}
export function failure(
  context: Pick<Failure, "kind" | "stage" | "target" | "reason">,
  action = "correct the input or resolve the reported stage before retrying"
): VideoFailure {
  return new VideoFailure({ ...context, action });
}
export function errorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  )
    return error.code;
  return undefined;
}
export function boundaryFailure(
  error: unknown,
  context: Pick<Failure, "stage" | "target">
): VideoFailure {
  if (error instanceof VideoFailure) return error;
  const code = errorCode(error);
  if (
    code &&
    [
      "ENOENT",
      "EACCES",
      "EPERM",
      "EEXIST",
      "ENOTDIR",
      "EISDIR",
      "ERR_FS_EISDIR",
      "MODULE_NOT_FOUND",
      "ERR_MODULE_NOT_FOUND"
    ].includes(code)
  ) {
    return failure(
      {
        ...context,
        kind: "environment",
        reason: `local dependency/filesystem ${code}`
      },
      "check the local runtime, path, permissions and exclusive output directory"
    );
  }
  return failure(
    {
      ...context,
      kind: "program",
      reason: "unexpected failure (unsafe exception text withheld)"
    },
    "preserve the output and report the stage for investigation"
  );
}
// Diagnostics are not transcript evidence. Filter complete bounded stderr before persistence.
export function safeDiagnostic(text: string): string {
  return text
    .replace(
      /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,
      "<redacted-private-key>"
    )
    .replace(
      /^.*(?:authorization|cookie|password|secret|token|api[_-]?key)["']?\s*[:=].*$/gim,
      "<redacted-credential-line>"
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1<redacted>@")
    .replace(
      /([?&](?:token|key|secret|password|signature|credential)=[^\s&#]*)/gi,
      "<redacted-query>"
    )
    .replace(
      /\b(?:sk-[a-z0-9_-]{16,}|hf_[a-z0-9]{16,})\b/gi,
      "<redacted-token>"
    );
}
export function parseJson(
  text: string,
  context: Pick<Failure, "stage" | "target">
): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw failure(
      { ...context, kind: "protocol", reason: "invalid JSON" },
      "preserve diagnostics and correct the JSON at its owning input or processing stage before retrying"
    );
  }
}
export function validate<TSchema extends v.GenericSchema>(
  schema: TSchema,
  value: unknown,
  context: Pick<Failure, "stage" | "target">
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, value);
  if (result.success) return result.output;
  const issue = result.issues[0];
  const field =
    issue?.path?.map((part) => String(part.key)).join(".") || "root";
  throw failure(
    {
      ...context,
      kind: "protocol",
      reason: `invalid ${field}: ${issue?.type ?? "schema"}`
    },
    "check the declared contract; preserve diagnostics and correct the owning input or processing stage before retrying"
  );
}
