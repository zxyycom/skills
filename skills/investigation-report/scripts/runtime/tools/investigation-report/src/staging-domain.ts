/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging-domain.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging-domain.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging-domain.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { acquireDomainPhase } from "./staging-domain-membership.ts";
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import {
  replacePendingSnapshot,
  samePendingSnapshots,
  type PendingSnapshot
} from "../../shared/src/version-control/pending-snapshot.ts";
import { investigationIndexNamespace } from "./investigation-state-index.ts";
import {
  domainStageControl,
  loadDomainSnapshot,
  openDomainRepository,
  resolveDomainSelection,
  verifyDomainIndex,
  type DomainRepository,
  type DomainSnapshot
} from "./staging-domain-context.ts";
import { domainIndexFile } from "./staging-domain-index.ts";
import {
  domainFailure,
  domainFailureDiagnostics,
  domainSourceReadFailure,
  pendingReplacementFailure
} from "./staging-domain-failures.ts";
import {
  compareText,
  stageDiagnostic,
  type DomainStageControl,
  type DomainStep,
  type InvestigationDomainStageInput
} from "./staging-domain-support.ts";
import {
  collectDomainWrites,
  prepareDomainAcquisitionRequest,
  verifyDomainWrites,
  type DomainAcquisitionRequest,
  type DomainPhaseFacts,
  type DomainWrite,
  type DomainWritesAcquisition
} from "./staging-domain-writes.ts";
import type { InvestigationStageResult } from "./types.ts";
export type { InvestigationDomainStageInput };

/** Two fresh domain phases precede one complete-snapshot-guarded pending patch. */
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
  const index = domainIndexFile(
    opened.value,
    snapshot.value,
    selection.value,
    control
  );
  if (index.status === "error") return index.result;
  let request: DomainAcquisitionRequest;
  try {
    request = await prepareDomainAcquisitionRequest({
      baseline: snapshot.value.baseline,
      pendingIndex: snapshot.value.pendingIndex,
      pendingReportPaths: snapshot.value.pendingReportPaths,
      pendingResourcePaths: snapshot.value.pending.members.map(
        (member) => member.path
      ),
      scope: input.scope,
      workspaceIndex: snapshot.value.workspaceIndex,
      revision: snapshot.value.revision,
      investigationsScope: opened.value.investigationsScope,
      repository: opened.value.repository,
      selectedIds: selection.value.selectedIds,
      sourceSelection: selection.value.sourceSelection
    });
  } catch (error) {
    return domainFailure(control, "revision-read-failed", error);
  }
  const prepared = await prepareDomainWrite(
    control,
    request,
    snapshot.value,
    index.value
  );
  if (prepared.status === "error") return prepared.result;
  return await writeDomainPending(control, opened.value, prepared.value);
}

type PreparedDomainWrite = Readonly<{
  updates: readonly DomainWrite[];
  pending: PendingSnapshot;
  preservedPaths: readonly string[];
  revision: DomainSnapshot["revision"];
  selectedIds: readonly string[];
}>;
async function prepareDomainWrite(
  control: DomainStageControl,
  request: DomainAcquisitionRequest,
  snapshot: DomainSnapshot,
  index: VersionControlFile | null
): Promise<DomainStep<PreparedDomainWrite>> {
  const phase = await acquireInitialDomainPhase(
    control,
    request,
    snapshot.pending
  );
  if (phase.status === "error") return phase;
  const first = await collectDomainWrites(request, phase.value);
  if (first.status === "error")
    return {
      status: "error",
      result: domainFailure(control, first.code, first.error)
    };
  const preserved = await preservedDomainPaths(
    control,
    request,
    snapshot,
    first.pending
  );
  if (preserved.status === "error") return preserved;
  const verified = await verifiedDomainWrite(control, request, snapshot, first);
  if (verified.status === "error") return verified;
  return {
    status: "ok",
    value: {
      updates: index === null ? first.value : [...first.value, index],
      pending: first.pending,
      preservedPaths: preserved.value,
      revision: snapshot.revision,
      selectedIds: request.selectedIds
    }
  };
}

async function verifiedDomainWrite(
  control: DomainStageControl,
  request: DomainAcquisitionRequest,
  snapshot: DomainSnapshot,
  first: DomainWritesAcquisition
): Promise<DomainStep<true>> {
  const phase = await reacquireVerifiedDomainPhase(
    control,
    request,
    snapshot,
    first.pending
  );
  if (phase.status === "error") return phase;
  const current = await collectDomainWrites(request, phase.value);
  const compared = verifyDomainWrites(first, current);
  if (compared.status === "error")
    return {
      status: "error",
      result: domainSourceReadFailure(control, compared.error)
    };
  if (compared.status === "drift")
    return {
      status: "error",
      result: domainSourceDrift(control, compared.reason)
    };
  return { status: "ok", value: true };
}
function domainSourceDrift(
  control: DomainStageControl,
  reason: string
): InvestigationStageResult {
  return domainFailureDiagnostics(control, "source-drift", [
    stageDiagnostic(
      "investigation-report.stage-source-drift",
      reason,
      control.indexPath
    )
  ]);
}
async function writeDomainPending(
  control: DomainStageControl,
  domain: DomainRepository,
  prepared: PreparedDomainWrite
): Promise<InvestigationStageResult> {
  let written: readonly string[];
  try {
    written = (
      await replacePendingSnapshot(domain.repository, {
        expectedRevision: prepared.revision,
        expectedSnapshot: prepared.pending,
        updates: prepared.updates
      })
    ).changedPaths;
  } catch (error) {
    return pendingReplacementFailure(control, error);
  }
  const paths = new Set(prepared.updates.map((update) => update.path));
  return {
    callerOwnedPaths:
      control.input.scope === "domain" ? [domain.repositoryIndexPath] : [],
    changed: written.length > 0,
    diagnostics: [],
    indexPath: control.indexPath,
    namespace: investigationIndexNamespace,
    preservedPendingPaths: prepared.preservedPaths
      .filter((file) => !paths.has(file))
      .sort(compareText),
    scope: control.input.scope,
    selectedIds: [...prepared.selectedIds],
    state: written.length > 0 ? "staged" : "unchanged",
    status: "ok",
    writtenPaths: [...written]
  };
}

async function preservedDomainPaths(
  control: DomainStageControl,
  request: DomainAcquisitionRequest,
  snapshot: DomainSnapshot,
  pending: PendingSnapshot
): Promise<DomainStep<readonly string[]>> {
  try {
    const value =
      snapshot.revision === null
        ? pending.members.map((member) => member.path)
        : await request.repository.listPendingChangedPaths({
            from: snapshot.revision,
            pathScopes: [request.investigationsScope]
          });
    return { status: "ok", value };
  } catch (error) {
    return {
      status: "error",
      result: domainFailure(control, "pending-read-failed", error)
    };
  }
}
async function reacquireVerifiedDomainPhase(
  control: DomainStageControl,
  request: DomainAcquisitionRequest,
  snapshot: DomainSnapshot,
  pending: PendingSnapshot
): Promise<DomainStep<DomainPhaseFacts>> {
  const indexDrift = await verifyDomainIndex(snapshot, control);
  if (indexDrift.status === "error")
    return {
      status: "error",
      result: domainFailureDiagnostics(
        control,
        "source-drift",
        indexDrift.diagnostics
      )
    };
  const phase = await acquireDomainPhase(request);
  if (phase.status === "error")
    return {
      status: "error",
      result:
        phase.code === "pending-read-failed"
          ? domainFailure(control, phase.code, phase.error)
          : domainSourceReadFailure(control, phase.error)
    };
  if (!samePendingSnapshots(pending, phase.value.pending))
    return {
      status: "error",
      result: domainFailureDiagnostics(control, "pending-conflict", [
        stageDiagnostic(
          "state-index.pending-conflict",
          "the pending snapshot changed before the write; reread it before retrying",
          control.indexPath
        )
      ])
    };
  return phase;
}

async function acquireInitialDomainPhase(
  control: DomainStageControl,
  request: DomainAcquisitionRequest,
  expectedPending: PendingSnapshot
): Promise<DomainStep<DomainPhaseFacts>> {
  const phase = await acquireDomainPhase(request);
  if (phase.status === "error")
    return {
      status: "error",
      result: domainFailure(control, phase.code, phase.error)
    };
  if (!samePendingSnapshots(expectedPending, phase.value.pending))
    return {
      status: "error",
      result: domainFailure(
        control,
        "pending-conflict",
        new Error("The pending snapshot changed during preparation")
      )
    };
  return phase;
}
