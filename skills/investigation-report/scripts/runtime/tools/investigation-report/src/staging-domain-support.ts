/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-domain-support.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-domain-support.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-domain-support.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { sameBytes as equalBytes } from "../../shared/src/node/bytes.ts";
import type {
  ReadonlyStateIndex,
  StateIndexDiagnostic
} from "../../index-runtime/src/index.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationStageResult
} from "./types.ts";

export type InvestigationIndex = ReadonlyStateIndex<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;

export type InvestigationDomainStageInput = Readonly<{
  investigationsDirectory: string;
  reportIds: readonly string[];
  scope: "all" | "domain";
}>;

/** Locates one domain stage transaction for diagnostics and failure results. */
export type DomainStageControl = Readonly<{
  indexPath: string;
  input: InvestigationDomainStageInput;
}>;

export type DomainStep<T> =
  | Readonly<{ status: "ok"; value: T }>
  | Readonly<{ status: "error"; result: InvestigationStageResult }>;

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareFiles(
  left: { path: string },
  right: { path: string }
): number {
  return compareText(left.path, right.path);
}

export function sameBytes(
  left: Uint8Array | null,
  right: Uint8Array | null
): boolean {
  if (left === null || right === null) return left === right;
  return equalBytes(left, right);
}

export function decodeUtf8(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(data);
}

export function stageDiagnostic(
  code: string,
  message: string,
  indexPath: string,
  stateId: string | null = null
): StateIndexDiagnostic {
  return { code, message, path: indexPath, stateId };
}
