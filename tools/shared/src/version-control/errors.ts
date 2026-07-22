export type VersionControlErrorCode =
  | "invalid-path"
  | "not-repository"
  | "operation-failed"
  | "revision-not-found";

export class VersionControlError extends Error {
  readonly code: VersionControlErrorCode;

  constructor(
    code: VersionControlErrorCode,
    message: string
  ) {
    super(message);
    this.name = "VersionControlError";
    this.code = code;
  }
}
