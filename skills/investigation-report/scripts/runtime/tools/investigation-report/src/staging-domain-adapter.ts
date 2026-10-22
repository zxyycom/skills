/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-domain-adapter.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-domain-adapter.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-domain-adapter.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { acquireDomainPhase } from "./staging-domain-membership.ts";
import {
  RecordStageError,
  type RecordStagePhase,
  type RecordDomainPreparation
} from "../../index-runtime/src/record-staging.ts";
import {
  serializeStateIndex,
  type StateIndex
} from "../../index-runtime/src/index.ts";
import { samePendingSnapshots } from "../../shared/src/version-control/pending-snapshot.ts";
import {
  loadDomainSnapshot,
  resolveDomainSelection,
  type DomainRepository,
  type DomainSnapshot,
  type DomainSelection
} from "./staging-domain-context.ts";
import {
  domainFailure,
  domainSourceReadFailure
} from "./staging-domain-failures.ts";
import type {
  DomainStageControl,
  DomainStep
} from "./staging-domain-support.ts";
import {
  collectDomainWrites,
  prepareDomainAcquisitionRequest,
  type DomainAcquisitionRequest,
  type DomainWriteFailure
} from "./staging-domain-writes.ts";
import type {
  InvestigationStageResult,
  InvestigationIndexState,
  InvestigationIndexMetadata
} from "./types.ts";

export type PhaseContext = Readonly<{
  snapshot: DomainSnapshot;
  selection: DomainSelection;
}>;
export class DomainStagePreparationError extends Error {
  readonly result: InvestigationStageResult;
  constructor(result: InvestigationStageResult) {
    super("Investigation stage preparation failed");
    this.result = result;
  }
}
function stageValue<T>(step: DomainStep<T>): T {
  if (step.status === "error")
    throw new DomainStagePreparationError(step.result);
  return step.value;
}

type DomainStageIndex = StateIndex<
  InvestigationIndexState,
  InvestigationIndexMetadata
>;
type InvestigationRecordPhase = RecordStagePhase<
  DomainStageIndex,
  PhaseContext
>;

/** One invocation owns fixed H resource membership and only this phase's retained payload paths. */
export class InvestigationStageAdapter {
  private readonly domain: DomainRepository;
  private readonly control: DomainStageControl;
  private readonly initial: DomainSnapshot;
  private headResourcePaths: readonly string[] | undefined;
  private retainedContentPaths: readonly string[] = [];

  constructor(
    domain: DomainRepository,
    control: DomainStageControl,
    initial: DomainSnapshot
  ) {
    this.domain = domain;
    this.control = control;
    this.initial = initial;
  }

  async acquire(
    stage: "prepare" | "verify",
    previous?: InvestigationRecordPhase
  ): Promise<InvestigationRecordPhase> {
    const snapshot =
      stage === "prepare"
        ? this.initial
        : stageValue(
            await loadDomainSnapshot(this.domain, this.control, {
              ...this.initial,
              contentPaths: this.retainedContentPaths,
              previous: previous?.context.snapshot
            })
          );
    const selection = stageValue(
      resolveDomainSelection(snapshot, this.control)
    );
    return {
      baseline: snapshot.baseline,
      workspace: snapshot.workspaceIndex,
      pendingIndex: snapshot.pendingIndex,
      pending: snapshot.pending,
      selectedIds: selection.selectedIds,
      workspaceEvidence:
        previous !== undefined && snapshot.workspaceIndex === previous.workspace
          ? previous.workspaceEvidence
          : serializeStateIndex(
              snapshot.workspaceIndex,
              snapshot.canonicalDefinition
            ),
      workspaceBytes: snapshot.workspaceBytes,
      context: { snapshot, selection }
    };
  }

  async prepareDomain(
    phase: InvestigationRecordPhase,
    _target: DomainStageIndex | null,
    stage: "prepare" | "verify"
  ): Promise<RecordDomainPreparation> {
    const request = await this.request(phase.context);
    const acquired = await acquireDomainPhase(request, phase.pending);
    if (acquired.status === "error") {
      if (acquired.code !== "pending-read-failed")
        throw sourcePreparationError(this.control, stage, acquired);
      const result = domainFailure(this.control, acquired.code, acquired.error);
      throw new DomainStagePreparationError(result);
    }
    if (!samePendingSnapshots(phase.pending, acquired.value.pending))
      throw new RecordStageError(
        "pending-conflict",
        "The pending snapshot changed during source preparation"
      );
    const writes = await collectDomainWrites(request, acquired.value);
    if (writes.status === "error")
      throw sourcePreparationError(this.control, stage, writes);
    if (stage === "prepare")
      this.retainedContentPaths = writes.pending.files.map((file) => file.path);
    return {
      pending: writes.pending,
      updates: writes.value,
      sourceFiles: writes.sourceFiles
    };
  }

  private async request({
    snapshot,
    selection
  }: PhaseContext): Promise<DomainAcquisitionRequest> {
    const requestInput = {
      baseline: snapshot.baseline,
      pendingIndex: snapshot.pendingIndex,
      pendingReportPaths: snapshot.pendingReportPaths,
      pendingResourcePaths: snapshot.pending.members.map(
        (member) => member.path
      ),
      scope: this.control.input.scope,
      workspaceIndex: snapshot.workspaceIndex,
      revision: snapshot.revision,
      investigationsScope: this.domain.investigationsScope,
      repository: this.domain.repository,
      selectedIds: selection.selectedIds,
      sourceSelection: selection.sourceSelection
    };
    let request: DomainAcquisitionRequest;
    try {
      request =
        this.headResourcePaths === undefined
          ? await prepareDomainAcquisitionRequest(requestInput)
          : {
              ...requestInput,
              headResourcePaths: this.headResourcePaths
            };
      this.headResourcePaths ??= request.headResourcePaths;
    } catch (error) {
      throw new DomainStagePreparationError(
        domainFailure(this.control, "revision-read-failed", error)
      );
    }

    return request;
  }
}

/** Convert phase-sensitive source failures before crossing the throwing adapter callback boundary. */
function sourcePreparationError(
  control: DomainStageControl,
  stage: "prepare" | "verify",
  failure: DomainWriteFailure
): DomainStagePreparationError {
  const result =
    stage === "verify"
      ? domainSourceReadFailure(control, failure.error)
      : domainFailure(control, failure.code, failure.error);
  return new DomainStagePreparationError(result);
}
