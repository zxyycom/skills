import { isFileSystemError } from "../../../shared/src/node/filesystem.ts";
import {
  createTestEvidenceDiagnostic,
  testEvidenceErrorText
} from "./diagnostics.ts";
import {
  testEntityIndexPath,
  testEvidenceLedgerIndexPath,
  type TestEvidenceDiagnostic
} from "./schemas.ts";

export type LedgerFileIdentity = Readonly<{
  device: bigint;
  inode: bigint;
  path: string;
}>;

type RequiredFileDiagnosticOptions = Readonly<{
  category: "entity-index" | "case";
  codePrefix: "entity-index" | "case";
  relativePath: string;
}>;

export function invalidRequiredFileDiagnostic(
  options: RequiredFileDiagnosticOptions
): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    category: options.category,
    code: `${options.codePrefix}.path-invalid`,
    message: `${options.relativePath} must be a regular file, not a symbolic link`,
    path: options.relativePath,
    severity: "error"
  });
}

export function invalidRequiredFileEncodingDiagnostic(
  options: RequiredFileDiagnosticOptions
): TestEvidenceDiagnostic {
  return createTestEvidenceDiagnostic({
    category: options.category,
    code: `${options.codePrefix}.encoding-invalid`,
    message: `${options.relativePath} must contain valid UTF-8 text`,
    path: options.relativePath,
    severity: "error"
  });
}

export function requiredFileReadDiagnostic(
  options: RequiredFileDiagnosticOptions,
  error: unknown
): TestEvidenceDiagnostic {
  const missing = isFileSystemError(error, "ENOENT");
  return createTestEvidenceDiagnostic({
    category: options.category,
    code: missing
      ? `${options.codePrefix}.missing`
      : `${options.codePrefix}.read-failed`,
    message: missing
      ? `${options.relativePath} does not exist`
      : `${options.relativePath} could not be read: ${testEvidenceErrorText(error)}`,
    path: options.relativePath,
    severity: "error"
  });
}

export function identityDiagnostics(
  identities: readonly LedgerFileIdentity[]
): TestEvidenceDiagnostic[] {
  const firstByIdentity = new Map<string, LedgerFileIdentity>();
  const diagnostics: TestEvidenceDiagnostic[] = [];
  for (const identity of identities) {
    const key = `${identity.device}:${identity.inode}`;
    const first = firstByIdentity.get(key);
    if (first === undefined) {
      firstByIdentity.set(key, identity);
      continue;
    }
    diagnostics.push(identityConflictDiagnostic(first, identity));
  }
  return diagnostics;
}

function identityConflictDiagnostic(
  first: LedgerFileIdentity,
  duplicate: LedgerFileIdentity
): TestEvidenceDiagnostic {
  const indexInvolved =
    first.path === testEvidenceLedgerIndexPath ||
    duplicate.path === testEvidenceLedgerIndexPath;
  const entityInvolved =
    first.path === testEntityIndexPath ||
    duplicate.path === testEntityIndexPath;
  return createTestEvidenceDiagnostic({
    category: indexInvolved
      ? "index"
      : entityInvolved
        ? "entity-index"
        : "case",
    code: indexInvolved
      ? "index.identity-conflict"
      : entityInvolved
        ? "entity-index.identity-conflict"
        : "case.identity-conflict",
    message: `${first.path} and ${duplicate.path} must have distinct file-system identities`,
    path: duplicate.path,
    severity: "error"
  });
}
