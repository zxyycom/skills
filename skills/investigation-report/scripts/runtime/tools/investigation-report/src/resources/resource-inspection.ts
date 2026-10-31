/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/resources/resource-inspection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/resources/resource-inspection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/resources/resource-inspection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { sanitizeInvestigationDiagnosticText } from "../diagnostics.ts";
import {
  fileSystemDiagnostic,
  type FileSystemDiagnostic
} from "../../../shared/src/node/filesystem-diagnostic.ts";

/** A real filesystem boundary keeps sanitized facts separate from path-validation issues. */
export class ResourceInspectionError extends Error {
  readonly diagnostic: FileSystemDiagnostic;

  constructor(diagnostic: FileSystemDiagnostic) {
    const detail = diagnostic.detail?.replace(/\p{Cc}/gu, " ") ?? null;
    super(detail ?? "resource inspection failed");
    this.name = "ResourceInspectionError";
    this.diagnostic = { ...diagnostic, detail };
  }
}

export async function inspectResource<T>(
  operation: string,
  target: string,
  read: () => Promise<T>
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    throw resourceInspectionFailure(error, operation, target);
  }
}

export type ResourceInspectionResult = Readonly<{
  errors: string[];
  failure?: ResourceInspectionError;
}>;

export function resourceInspectionFailure(
  error: unknown,
  operation: string,
  target: string
): ResourceInspectionError {
  const diagnostic = fileSystemDiagnostic(error, { operation, target }) ?? {
    causeCategory: "unknown" as const,
    detail: sanitizeInvestigationDiagnosticText(error),
    operation,
    target
  };
  return new ResourceInspectionError(diagnostic);
}
