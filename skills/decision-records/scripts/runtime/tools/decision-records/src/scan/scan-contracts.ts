/*
 * Synced TypeScript runtime; repository maintenance edits tools/decision-records/src/scan/scan-contracts.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/decision-records/src/scan/scan-contracts.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/decision-records/src/scan/scan-contracts.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import type { DecisionMarkdownSource } from "../records/decision-metadata.ts";
import type { DecisionId, DecisionIndex, DecisionRecord } from "../types.ts";

export type DecisionStoredIndexEntry = DecisionIndex["entries"][DecisionId];

export type SourceFile = {
  decisionPath: string;
  /** 成员发现与正式验证复用本次采集，后续 fresh 另建来源。 */
  markdownSource?: DecisionMarkdownSource;
  sourcePath: string;
  sourceText?: string;
  sourceReadFailed?: true;
};

export type SourceFileMembers = [SourceFile, ...SourceFile[]];

export type DecisionScanLocation = {
  decisionsDirectory: string;
  decisionsLabel: string;
  indexPath: string;
  indexRelativePath: string;
  workspaceRoot: string;
};

export type ScannedSourceState = Pick<
  DecisionRecord,
  "activationCandidate" | "bodyReady" | "document" | "scaffoldValid" | "source"
>;

export type CandidateSourceState = Pick<
  ScannedSourceState,
  "activationCandidate" | "bodyReady" | "scaffoldValid"
>;

export type ScannedSourceMetadata = Pick<
  DecisionRecord,
  "alignment" | "createdAt" | "projection" | "status" | "tags"
>;
