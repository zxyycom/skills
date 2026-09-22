import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import { changedPendingPaths } from "../../shared/src/version-control/index.ts";
import { investigationIndexNamespace } from "./investigation-state-index.ts";
import {
  domainStageControl,
  loadDomainSnapshot,
  openDomainRepository,
  readHeadScope,
  readPendingScope,
  resolveDomainSelection,
  type DomainRepository,
  type DomainSelection,
  type DomainSnapshot
} from "./staging-domain-context.ts";
import { domainIndexFile } from "./staging-domain-index.ts";
import {
  domainFailure,
  domainFailureDiagnostics,
  pendingReplacementFailure
} from "./staging-domain-failures.ts";
import {
  compareFiles,
  compareText,
  sameBytes,
  stageDiagnostic,
  type DomainStageControl,
  type DomainStep
} from "./staging-domain-support.ts";
import {
  collectDomainWrites,
  verifyDomainWrites,
  type DomainWrite
} from "./staging-domain-writes.ts";
import type { InvestigationStageResult } from "./types.ts";

import type { InvestigationDomainStageInput } from "./staging-domain-support.ts";
export type { InvestigationDomainStageInput };

/**
 * Stages the formal Investigation domain within one literal pending scope:
 * selected report Markdown plus the complete owner resource tree (workspace
 * and HEAD member union), while every other pending path in the investigation
 * scope - the derived index for `domain`, candidates, unselected reports, and
 * other owners' resources - keeps its current pending bytes.
 */
export async function stageInvestigationDomain(
  input: InvestigationDomainStageInput
): Promise<InvestigationStageResult> {
  const control = domainStageControl(input);
  const opened = await openDomainRepository(control);
  if (opened.status === "error") return opened.result;
  const snapshot = await loadDomainSnapshot(opened.value, control);
  if (snapshot.status === "error") return snapshot.result;
  const selection = resolveDomainSelection(snapshot.value, control);
  if (selection.status === "error") return selection.result;
  const indexFile = domainIndexFile(
    opened.value,
    snapshot.value,
    selection.value,
    control
  );
  if (indexFile.status === "error") return indexFile.result;
  const prepared = await prepareDomainWrite({
    control,
    domain: opened.value,
    indexFile: indexFile.value,
    selection: selection.value,
    snapshot: snapshot.value
  });
  if (prepared.status === "error") return prepared.result;
  return await writeDomainPending({
    control,
    domain: opened.value,
    prepared: prepared.value
  });
}

type PreparedDomainWrite = Readonly<{
  domainPaths: ReadonlySet<string>;
  files: VersionControlFile[];
  headFiles: VersionControlFile[];
  pending: VersionControlFile[];
  revision: DomainSnapshot["revision"];
  selectedIds: readonly string[];
}>;

async function prepareDomainWrite(options: {
  control: DomainStageControl;
  domain: DomainRepository;
  indexFile: VersionControlFile | null;
  selection: DomainSelection;
  snapshot: DomainSnapshot;
}): Promise<DomainStep<PreparedDomainWrite>> {
  const reads = await readDomainScope(options);
  if (reads.status === "error") return reads;
  const verified = await verifiedDomainWrite(options, reads.value.writes);
  if (verified.status === "error") return verified;
  const target = assemblePendingTarget({
    indexFile: options.indexFile,
    pending: reads.value.pending,
    writes: reads.value.writes
  });
  return {
    status: "ok",
    value: {
      domainPaths: target.domainPaths,
      files: target.files,
      headFiles: reads.value.headFiles,
      pending: reads.value.pending,
      revision: options.snapshot.revision,
      selectedIds: options.selection.selectedIds
    }
  };
}

type DomainWriteOptionsInput = Readonly<{
  control: DomainStageControl;
  domain: DomainRepository;
  selection: DomainSelection;
  snapshot: DomainSnapshot;
}>;

function domainWriteOptions(options: DomainWriteOptionsInput) {
  return {
    investigationsDirectory: options.control.input.investigationsDirectory,
    investigationsScope: options.domain.investigationsScope,
    repository: options.domain.repository,
    revision: options.snapshot.revision,
    selectedIds: options.selection.selectedIds,
    workspaceIndex: options.snapshot.workspaceIndex
  };
}

type DomainScopeReads = Readonly<{
  writes: DomainWrite[];
  pending: VersionControlFile[];
  headFiles: VersionControlFile[];
}>;

/** Reads the selected domain writes plus the pending and HEAD scope states. */
async function readDomainScope(
  options: DomainWriteOptionsInput
): Promise<DomainStep<DomainScopeReads>> {
  const { control, domain, snapshot } = options;
  const writes = await collectDomainWrites(domainWriteOptions(options));
  if (writes.status === "error") {
    return {
      status: "error",
      result: domainFailure(control, writes.code, writes.error)
    };
  }
  const pending = await readPendingScope(
    domain.repository,
    domain.investigationsScope
  );
  if (pending.status === "error") {
    return {
      status: "error",
      result: domainFailure(control, "pending-read-failed", pending.error)
    };
  }
  const headFiles = await readHeadScope(
    domain.repository,
    snapshot.revision,
    domain.investigationsScope
  );
  if (headFiles.status === "error") {
    return {
      status: "error",
      result: domainFailure(control, "revision-read-failed", headFiles.error)
    };
  }
  return {
    status: "ok",
    value: {
      headFiles: headFiles.value,
      pending: pending.value,
      writes: writes.value
    }
  };
}

/** Rereads the prepared writes right before replacement to reject drift. */
async function verifiedDomainWrite(
  options: DomainWriteOptionsInput,
  writes: readonly DomainWrite[]
): Promise<DomainStep<true>> {
  const drift = await verifyDomainWrites({
    ...domainWriteOptions(options),
    writes
  });
  if (drift !== null) {
    return {
      status: "error",
      result: domainSourceDrift(options.control, drift)
    };
  }
  return { status: "ok", value: true };
}

function domainSourceDrift(
  control: DomainStageControl,
  drift: string
): InvestigationStageResult {
  return domainFailureDiagnostics(control, "source-drift", [
    stageDiagnostic(
      "investigation-report.stage-source-drift",
      drift,
      control.indexPath
    )
  ]);
}

/**
 * The replacement target starts from the current pending scope so already
 * staged deletions of unrelated paths stay deleted; HEAD content must not
 * re-enter the target, or a later stage would silently resurrect them.
 */
function assemblePendingTarget(options: {
  indexFile: VersionControlFile | null;
  pending: readonly VersionControlFile[];
  writes: readonly DomainWrite[];
}): { domainPaths: Set<string>; files: VersionControlFile[] } {
  const targetByPath = new Map<string, Uint8Array>();
  for (const file of options.pending) {
    targetByPath.set(file.path, file.data);
  }
  const domainPaths = new Set<string>();
  for (const write of options.writes) {
    domainPaths.add(write.path);
    if (write.data === null) {
      targetByPath.delete(write.path);
    } else {
      targetByPath.set(write.path, write.data);
    }
  }
  if (options.indexFile !== null) {
    domainPaths.add(options.indexFile.path);
    targetByPath.set(options.indexFile.path, options.indexFile.data);
  }
  const files = [...targetByPath.entries()]
    .map(([filePath, data]) => ({ data, path: filePath }))
    .sort(compareFiles);
  return { domainPaths, files };
}

async function writeDomainPending(options: {
  control: DomainStageControl;
  domain: DomainRepository;
  prepared: PreparedDomainWrite;
}): Promise<InvestigationStageResult> {
  const { control, domain, prepared } = options;
  try {
    await domain.repository.replacePendingFiles({
      expectedFiles: prepared.pending,
      expectedRevision: prepared.revision,
      files: prepared.files,
      pathScope: domain.investigationsScope
    });
  } catch (error) {
    return pendingReplacementFailure(control, error);
  }
  return domainStageSuccess(control, domain, prepared);
}

function domainStageSuccess(
  control: DomainStageControl,
  domain: DomainRepository,
  prepared: PreparedDomainWrite
): InvestigationStageResult {
  const written = changedPendingPaths(prepared.pending, prepared.files);
  const headByPath = new Map(
    prepared.headFiles.map((file) => [file.path, file.data] as const)
  );
  const preserved = prepared.pending
    .filter(
      (file) =>
        !prepared.domainPaths.has(file.path) &&
        !sameBytes(headByPath.get(file.path) ?? null, file.data)
    )
    .map((file) => file.path)
    .sort(compareText);
  return {
    callerOwnedPaths:
      control.input.scope === "domain" ? [domain.repositoryIndexPath] : [],
    changed: written.length > 0,
    diagnostics: [],
    indexPath: control.indexPath,
    namespace: investigationIndexNamespace,
    preservedPendingPaths: preserved,
    scope: control.input.scope,
    selectedIds: [...prepared.selectedIds],
    state: written.length > 0 ? "staged" : "unchanged",
    status: "ok",
    writtenPaths: written
  };
}
