import { Buffer } from "node:buffer";
import type {
  StateIndex,
  StateIndexDiagnostic
} from "../../index-runtime/src/index.ts";
import type {
  InvestigationIndexMetadata,
  InvestigationIndexState,
  InvestigationStageResult
} from "./types.ts";

export type InvestigationIndex = StateIndex<
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
  | { status: "ok"; value: T }
  | { status: "error"; result: InvestigationStageResult };

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
  return Buffer.from(left).equals(Buffer.from(right));
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
