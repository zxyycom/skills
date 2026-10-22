/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-domain.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-domain.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-domain.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import {
  InvestigationStageAdapter,
  DomainStagePreparationError,
  type PhaseContext
} from "./staging-domain-adapter.ts";
import {
  stageRecordSelection,
  RecordStageError,
  RecordStagePublicationError,
  type RecordStageResult
} from "../../index-runtime/src/record-staging.ts";
import {
  buildStateIndexFromSnapshot,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import { investigationIndexNamespace } from "./investigation-state-index.ts";
import {
  domainStageControl,
  loadDomainSnapshot,
  openDomainRepository,
  type DomainRepository,
  type DomainSnapshot
} from "./staging-domain-context.ts";
import {
  domainFailure,
  domainFailureDiagnostics,
  pendingReplacementFailure
} from "./staging-domain-failures.ts";
import {
  compareText,
  stageDiagnostic,
  type DomainStageControl,
  type InvestigationDomainStageInput
} from "./staging-domain-support.ts";
import type {
  InvestigationStageResult,
  InvestigationIndexState,
  InvestigationIndexMetadata
} from "./types.ts";
import type { StateIndex } from "../../index-runtime/src/index.ts";
export type { InvestigationDomainStageInput };

/** Domain safety adapts to the shared record-stage phase and publication owner. */
export async function stageInvestigationDomain(
  input: InvestigationDomainStageInput
): Promise<InvestigationStageResult> {
  const control = domainStageControl(input);
  const opened = await openDomainRepository(control);
  if (opened.status === "error") return opened.result;
  const domain = opened.value;
  const loaded = await loadDomainSnapshot(domain, control);
  if (loaded.status === "error") return loaded.result;
  const initial = loaded.value;
  const adapter = new InvestigationStageAdapter(domain, control, initial);
  let preservedPaths: readonly string[];
  try {
    preservedPaths = await changedDomainPendingPaths(domain, initial);
  } catch (error) {
    return domainFailure(control, "pending-read-failed", error);
  }
  try {
    const staged = await stageRecordSelection<
      InvestigationIndexState,
      InvestigationIndexMetadata,
      StateIndex<InvestigationIndexState, InvestigationIndexMetadata>,
      PhaseContext
    >({
      repository: domain.repository,
      revision: initial.revision,
      scope: input.scope,
      indexPath: domain.repositoryIndexPath,
      acquire: adapter.acquire.bind(adapter),
      build: (snapshot) =>
        buildStateIndexFromSnapshot(
          initial.canonicalDefinition,
          snapshot,
          domain.repositoryIndexPath
        ),
      serialize: (index) =>
        serializeStateIndex(index, initial.canonicalDefinition),
      prepareDomain: adapter.prepareDomain.bind(adapter)
    });
    return investigationStageSuccess(
      control,
      domain.repositoryIndexPath,
      staged,
      preservedPaths
    );
  } catch (error) {
    return recordStageFailure(control, error);
  }
}

function investigationStageSuccess(
  control: DomainStageControl,
  repositoryIndexPath: string,
  staged: RecordStageResult<
    StateIndex<InvestigationIndexState, InvestigationIndexMetadata>,
    PhaseContext
  >,
  preservedPaths: readonly string[]
): InvestigationStageResult {
  const input = control.input;
  const paths = new Set(staged.updates.map((update) => update.path));
  const written = staged.replacement.changedPaths;
  return {
    callerOwnedPaths: input.scope === "domain" ? [repositoryIndexPath] : [],
    changed: written.length > 0,
    diagnostics: [],
    indexPath: control.indexPath,
    namespace: investigationIndexNamespace,
    preservedPendingPaths: preservedPaths
      .filter((file) => !paths.has(file))
      .sort(compareText),
    scope: input.scope,
    selectedIds: [...staged.phase.selectedIds],
    state: written.length > 0 ? "staged" : "unchanged",
    status: "ok",
    writtenPaths: [...written]
  };
}

function recordStageFailure(
  control: DomainStageControl,
  error: unknown
): InvestigationStageResult {
  if (error instanceof DomainStagePreparationError) {
    return error.result;
  }
  if (error instanceof RecordStagePublicationError) {
    return pendingReplacementFailure(control, error.cause);
  }
  if (!(error instanceof RecordStageError)) {
    return domainFailure(control, "source-read-failed", error);
  }
  if (error.kind === "pending-deleted") {
    return domainFailure(control, "pending-read-failed", error);
  }
  const code =
    error.kind === "source-drift"
      ? "investigation-report.stage-source-drift"
      : error.kind === "pending-conflict"
        ? "state-index.pending-conflict"
        : "state-index.stage-collection-changed";
  if (error.diagnostics.length === 0) {
    return domainFailureDiagnostics(control, error.kind, [
      stageDiagnostic(code, error.message, control.indexPath)
    ]);
  }
  const diagnostics = error.diagnostics.map((item) => ({
    ...item,
    message: item.message + "; " + error.message
  }));
  return domainFailureDiagnostics(control, error.kind, diagnostics);
}

/** Result preservation uses changed-path metadata, never all fixed-H source payloads. */
async function changedDomainPendingPaths(
  domain: DomainRepository,
  initial: DomainSnapshot
): Promise<readonly string[]> {
  return initial.revision === null
    ? initial.pending.members.map((member) => member.path)
    : await domain.repository.listPendingChangedPaths({
        from: initial.revision,
        pathScopes: [domain.investigationsScope]
      });
}
