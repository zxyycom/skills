import type { InvestigationPreparation } from "../transactions/strict-preparation.ts";
import type { RecordFileSnapshot } from "../../../record-operations/src/transactions/transaction-files.ts";
import type {
  InvestigationIndexState,
  ParsedInvestigationReport
} from "../types.ts";
import type {
  InvestigationDiagnostic,
  InvestigationMutationDiagnostic
} from "../diagnostics.ts";
import type { ParsedInvestigationReportDocument } from "../types.ts";

export type InvestigationRenameOptions = Readonly<{
  investigationsDir?: string;
  preflight?: boolean;
  renameRecordedCandidate?: boolean;
  renameRecordedReport?: boolean;
  source: string;
  target: string;
  workspaceRoot: string;
}>;

export type InvestigationRenamePlan = Readonly<{
  affectedCandidateRelationCount: number;
  affectedEstablishedRelationCount: number;
  affectedResourceReferenceCount: number;
  newId: string;
  newName: string;
  newSourcePath: string;
  oldId: string;
  oldName: string;
  oldSourcePath: string;
  outcome: "preflight" | "ready";
  resourceOwnerMoved: boolean;
}>;

export type InvestigationRenameResult = Readonly<{
  changed: boolean;
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  indexPath: string;
  mutation?: InvestigationMutationDiagnostic;
  plan: InvestigationRenamePlan | null;
  status: "attention" | "error" | "ok";
}>;

export type InvestigationRenameWriter = (
  targetPath: string,
  text: string
) => Promise<void>;

export type InvestigationRenameHooks = Readonly<{
  beforePublish?: () => Promise<void>;
  beforeResourceMove?: () => Promise<void>;
  beforeSourceOwnerRemoval?: () => Promise<void>;
  writeExisting?: InvestigationRenameWriter;
  writeNew?: InvestigationRenameWriter;
}>;

export type RenameSource = Readonly<{
  parsed?: ParsedInvestigationReport;
  state?: InvestigationIndexState;
  candidate: boolean;
  document: ParsedInvestigationReportDocument;
  filePath: string;
  id: string;
  sourcePath: string;
  text: string;
}>;

export type ResourceOwnerSnapshot = Readonly<{
  directories: readonly ResourceDirectorySnapshot[];
  files: readonly ResourceFileSnapshot[];
  mode: number;
}>;

export type ResourceDirectorySnapshot = Readonly<{
  mode: number;
  path: string;
}>;

export type ResourceFileSnapshot = Readonly<{
  contentHash: string;
  mode: number;
  path: string;
  size: number;
}>;

export type ResourceMove = Readonly<{
  from: string;
  snapshot: ResourceOwnerSnapshot;
  to: string;
  root?: string;
}>;

export type ResourceDirectoryIdentity = Readonly<{
  dev: number;
  ino: number;
  mode: number;
}>;

/** Mutable ownership journal for one resource move and its possible recovery. */
export type ResourceMoveProgress = {
  targetClaimed: boolean;
  sourceFiles: Map<string, RecordFileSnapshot>;
  writtenFiles: Map<string, RecordFileSnapshot>;
  removedFiles: Set<string>;
  sourceDirectories: Map<string, ResourceDirectoryIdentity>;
  targetDirectories: Map<string, ResourceDirectoryIdentity>;
  removedDirectories: Set<string>;
  uncertainWrite: boolean;
};

export type PreparedRename = Readonly<{
  preparation?: InvestigationPreparation;
  indexPath: string;
  noChange: boolean;
  nextIndexText: string | null;
  oldIndexText: string | null;
  originalSources: readonly RenameSource[];
  plan: InvestigationRenamePlan;
  resourceMove: ResourceMove | null;
  sourceBefore: RenameSource;
  sources: readonly RenameSource[];
  targetSource: RenameSource;
}>;
