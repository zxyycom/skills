import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import { changedPendingPaths } from "../../shared/src/version-control/index.ts";
import { investigationIndexNamespace } from "./investigation-state-index.ts";
import {
  domainStageControl,
  loadDomainSnapshot,
  openDomainRepository,
  readPendingScope,
  resolveDomainSelection,
  verifyDomainIndex,
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
  stageDiagnostic,
  type DomainStageControl,
  type DomainStep
} from "./staging-domain-support.ts";
import {
  collectDomainWrites,
  verifyDomainWrites,
  type DomainWrite,
  type DomainWriteOptions,
  type DomainWritesAcquisition
} from "./staging-domain-writes.ts";
import type { InvestigationStageResult } from "./types.ts";

import type { InvestigationDomainStageInput } from "./staging-domain-support.ts";
export type { InvestigationDomainStageInput };

/**
 * Stages the formal Investigation domain within one literal pending scope:
 * selected report Markdown plus the complete owner resource tree (workspace
 * and HEAD member union), while every other pending path in the investigation
 * scope - the derived index for `domain`, candidates, unselected reports, and
 * other owners' resources - keeps its current pending bytes and representation.
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
  files: readonly VersionControlFile[];
  preservedPaths: readonly string[];
  pending: readonly VersionControlFile[];
  revision: DomainSnapshot["revision"];
  selectedIds: readonly string[];
}>;

async function prepareDomainWrite(
  options: Readonly<{
    control: DomainStageControl;
    domain: DomainRepository;
    indexFile: VersionControlFile | null;
    selection: DomainSelection;
    snapshot: DomainSnapshot;
  }>
): Promise<DomainStep<PreparedDomainWrite>> {
  const reads = await readDomainScope(options);
  if (reads.status === "error") return reads;
  const verified = await verifiedDomainWrite(options, reads.value);
  if (verified.status === "error") return verified;
  const target = assemblePendingTarget({
    indexFile: options.indexFile,
    pending: reads.value.pending,
    writes: reads.value.acquisition.value
  });
  return {
    status: "ok",
    value: {
      domainPaths: target.domainPaths,
      files: target.files,
      preservedPaths: reads.value.preservedPaths,
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

function domainWriteOptions(
  options: Pick<DomainWriteOptionsInput, "domain" | "selection" | "snapshot">
): DomainWriteOptions {
  return {
    baseline: options.snapshot.baseline,
    investigationsScope: options.domain.investigationsScope,
    repository: options.domain.repository,
    revision: options.snapshot.revision,
    sourceSelection: options.selection.sourceSelection,
    selectedIds: options.selection.selectedIds,
    workspaceIndex: options.snapshot.workspaceIndex
  };
}

type DomainScopeReads = Readonly<{
  acquisition: DomainWritesAcquisition;
  pending: readonly VersionControlFile[];
  preservedPaths: readonly string[];
}>;

/** Reads the selected domain writes plus the pending and HEAD scope states. */
async function readDomainScope(
  options: DomainWriteOptionsInput
): Promise<DomainStep<DomainScopeReads>> {
  const { control, domain } = options;
  const pending = await readPendingScope(
    domain.repository,
    domain.investigationsScope
  );
  if (pending.status === "error")
    return {
      status: "error",
      result: domainFailure(control, "pending-read-failed", pending.error)
    };
  const writes = await collectDomainWrites({
    ...domainWriteOptions(options),
    pendingFiles: pending.value
  });
  if (writes.status === "error")
    return {
      status: "error",
      result: domainFailure(control, writes.code, writes.error)
    };
  const preserved = await preservedDomainPaths(options, pending.value);
  if (preserved.status === "error") return preserved;
  return {
    status: "ok",
    value: {
      pending: pending.value,
      preservedPaths: preserved.value,
      acquisition: writes
    }
  };
}

async function preservedDomainPaths(
  { control, domain, snapshot }: DomainWriteOptionsInput,
  pending: readonly VersionControlFile[]
): Promise<DomainStep<readonly string[]>> {
  let preservedPaths: readonly string[];
  try {
    preservedPaths =
      snapshot.revision === null
        ? pending.map((file) => file.path)
        : await domain.repository.listPendingChangedPaths({
            from: snapshot.revision,
            pathScopes: [domain.investigationsScope]
          });
  } catch (error) {
    return {
      status: "error",
      result: domainFailure(control, "pending-read-failed", error)
    };
  }
  return { status: "ok", value: preservedPaths };
}

/** Rereads the prepared writes right before replacement to reject drift. */
async function verifiedDomainWrite(
  options: DomainWriteOptionsInput,
  reads: DomainScopeReads
): Promise<DomainStep<true>> {
  const indexDrift = await verifyDomainIndex(options.snapshot, options.control);
  if (indexDrift !== null)
    return {
      status: "error",
      result: domainSourceDrift(options.control, indexDrift)
    };
  const pending = await verifiedDomainPending(options, reads.pending);
  if (pending.status === "error") return pending;
  const drift = await verifyDomainWrites({
    ...domainWriteOptions(options),
    pendingFiles: pending.value,
    headResourcePaths: reads.acquisition.headResourcePaths,
    sourceFiles: reads.acquisition.sourceFiles,
    writes: reads.acquisition.value
  });
  if (drift !== null) {
    return {
      status: "error",
      result: domainSourceDrift(options.control, drift)
    };
  }
  return { status: "ok", value: true };
}

async function verifiedDomainPending(
  options: DomainWriteOptionsInput,
  expected: readonly VersionControlFile[]
): Promise<DomainStep<readonly VersionControlFile[]>> {
  const pending = await readPendingScope(
    options.domain.repository,
    options.domain.investigationsScope
  );
  if (pending.status === "error")
    return {
      status: "error",
      result: domainFailure(
        options.control,
        "pending-read-failed",
        pending.error
      )
    };
  if (changedPendingPaths(expected, pending.value).length > 0)
    return {
      status: "error",
      result: domainFailureDiagnostics(options.control, "pending-conflict", [
        stageDiagnostic(
          "state-index.pending-conflict",
          "the pending snapshot changed before the write; reread it before retrying",
          options.control.indexPath
        )
      ])
    };
  return { status: "ok", value: pending.value };
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
function assemblePendingTarget(
  options: Readonly<{
    indexFile: VersionControlFile | null;
    pending: readonly VersionControlFile[];
    writes: readonly DomainWrite[];
  }>
): Readonly<{
  domainPaths: ReadonlySet<string>;
  files: readonly VersionControlFile[];
}> {
  const targetByPath = new Map<string, VersionControlFile>();
  for (const file of options.pending) {
    targetByPath.set(file.path, file);
  }
  const domainPaths = new Set<string>();
  for (const write of options.writes) {
    domainPaths.add(write.path);
    if (write.data === null) {
      targetByPath.delete(write.path);
    } else {
      targetByPath.set(write.path, write);
    }
  }
  if (options.indexFile !== null) {
    domainPaths.add(options.indexFile.path);
    targetByPath.set(options.indexFile.path, options.indexFile);
  }
  const files = [...targetByPath.values()].sort(compareFiles);
  return { domainPaths, files };
}

async function writeDomainPending(
  options: Readonly<{
    control: DomainStageControl;
    domain: DomainRepository;
    prepared: PreparedDomainWrite;
  }>
): Promise<InvestigationStageResult> {
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
  const preserved = prepared.preservedPaths
    .filter((filePath) => !prepared.domainPaths.has(filePath))
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
