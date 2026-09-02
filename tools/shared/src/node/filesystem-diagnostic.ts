import { operationErrorDetail } from "./error-detail.ts";

export type FileSystemErrorCauseCategory =
  | "access-denied"
  | "not-found"
  | "unknown";

export type FileSystemDiagnostic = Readonly<{
  causeCategory: FileSystemErrorCauseCategory;
  detail: string | null;
  operation: string;
  target: string | null;
}>;

const nodeFileSystemErrorCodes = new Set([
  "EACCES",
  "EBADF",
  "EBUSY",
  "EDQUOT",
  "EEXIST",
  "EFBIG",
  "EINTR",
  "EIO",
  "EISDIR",
  "ELOOP",
  "EMFILE",
  "ENAMETOOLONG",
  "ENFILE",
  "ENODEV",
  "ENOENT",
  "ENOSPC",
  "ENOTDIR",
  "EPERM",
  "EROFS",
  "ESTALE",
  "ETXTBSY"
]);

export function fileSystemDiagnostic(
  error: unknown,
  options: Readonly<{ operation: string; target?: string | null }>
): FileSystemDiagnostic | undefined {
  if (!isNodeFileSystemError(error)) {
    return undefined;
  }
  return {
    causeCategory: classifyFileSystemErrorCause(error),
    detail: operationErrorDetail(error),
    operation: options.operation,
    target: options.target ?? null
  };
}

function classifyFileSystemErrorCause(
  error: NodeJS.ErrnoException
): FileSystemErrorCauseCategory {
  if (error.code === "EACCES" || error.code === "EPERM") {
    return "access-denied";
  }
  return error.code === "ENOENT" ? "not-found" : "unknown";
}

function isNodeFileSystemError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    nodeFileSystemErrorCodes.has(error.code)
  );
}
