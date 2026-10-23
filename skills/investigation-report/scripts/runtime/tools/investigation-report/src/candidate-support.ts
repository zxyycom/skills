/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/candidate-support.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/candidate-support.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/candidate-support.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import fs from "node:fs/promises";
import type { RecordWriteIdentity } from "../../record-operations/src/transaction-files.ts";
import path from "node:path";
import { err, ok, type Result } from "neverthrow";
import { InvestigationCollectionMutationLockError } from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import { discoverInvestigationCandidates } from "./candidate-discovery.ts";
import type {
  InvestigationCandidateCreateResult,
  InvestigationCandidateListResult,
  InvestigationCandidateShowResult
} from "./types.ts";

export async function safeCandidateLayout(
  investigationsDirectory: string
): Promise<
  | {
      status: "ok";
      value: Awaited<ReturnType<typeof discoverInvestigationCandidates>>;
    }
  | {
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }
> {
  try {
    const layout = await discoverInvestigationCandidates(
      investigationsDirectory
    );
    return { status: "ok", value: layout };
  } catch (error) {
    return {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.candidate-layout-unavailable",
          error,
          reason: "the investigation root could not be safely inspected",
          recovery: "resolve the reported root-directory problem, then retry",
          target: investigationsDirectory
        })
      ],
      errors: [
        "investigation root could not be safely inspected: " + errorText(error)
      ],
      status: "error"
    };
  }
}

export async function writeCandidateAtomically(
  target: string,
  markdown: string
): Promise<
  Result<
    Readonly<{ warnings: string[]; identity: RecordWriteIdentity }>,
    unknown
  >
> {
  const temporary = candidateTemporaryPath(target);
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let published = false;
  try {
    await verifyCandidateStagingFilesystem(target);
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(markdown, "utf8");
    await handle.sync();
    const identity = await handle.stat();
    await handle.close();
    handle = undefined;
    await fs.link(temporary, target);
    published = true;
    return (await removePublishedTemporary(temporary)).map((value) => ({
      ...value,
      identity: {
        dev: identity.dev,
        ino: identity.ino,
        mode: identity.mode & 0o7777
      }
    }));
  } catch (error) {
    return err(error);
  } finally {
    await handle?.close().catch(() => undefined);
    if (!published)
      await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

function candidateTemporaryPath(target: string): string {
  const candidateDirectory = path.dirname(target);
  return path.join(
    path.dirname(candidateDirectory),
    `.investigation-candidate-${path.basename(target)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
}

async function verifyCandidateStagingFilesystem(target: string): Promise<void> {
  const candidateDirectory = path.dirname(target);
  const [candidateStats, stagingStats] = await Promise.all([
    fs.stat(candidateDirectory),
    fs.stat(path.dirname(candidateDirectory))
  ]);
  if (candidateStats.dev !== stagingStats.dev)
    throw new Error(
      "candidate staging directory is not on the investigation collection filesystem"
    );
}

async function removePublishedTemporary(
  temporary: string
): Promise<Result<Readonly<{ warnings: string[] }>, unknown>> {
  try {
    await fs.rm(temporary, { force: true });
    return ok({ warnings: [] });
  } catch (error) {
    return ok({
      warnings: [
        `candidate was created but its temporary creation file could not be removed: ${errorText(error)}`
      ]
    });
  }
}

export function createCandidateFailure(
  status: "invalid-options" | "error",
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationCandidateCreateResult {
  return {
    candidate: null,
    changed: false,
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    status,
    warnings: []
  };
}
export function candidateListFailure(
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationCandidateListResult {
  return {
    candidates: [],
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    status: "error",
    warnings: []
  };
}
export function candidateShowFailure(
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationCandidateShowResult {
  return {
    candidate: null,
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    status: "error",
    warnings: []
  };
}
export function candidateOperationDiagnostic(
  error: unknown,
  investigationsDirectory: string
): InvestigationDiagnostic {
  if (error instanceof InvestigationCollectionMutationLockError)
    return error.diagnostic;
  return diagnosticFromError({
    code: "investigation-report.candidate-create-transaction-failed",
    error,
    reason:
      "the investigation candidate creation transaction stopped unexpectedly",
    recovery:
      "inspect the reported failure and candidate path before retrying the creation",
    target: investigationsDirectory
  });
}
export function errorText(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "unavailable error detail";
}
export function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
