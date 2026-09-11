import type { DecisionId, DecisionIndex, DecisionRecord } from "./types.ts";

export type DecisionStoredIndexEntry = DecisionIndex["entries"][DecisionId];

export type SourceFile = {
  decisionPath: string;
  sourcePath: string;
  sourceText?: string;
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
