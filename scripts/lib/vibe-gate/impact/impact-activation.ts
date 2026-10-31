import path from "node:path";
import { operationErrorDetail } from "../../../../tools/shared/src/node/error-detail.ts";
import { rootDir } from "../../project.ts";
import {
  baseGateCheckIds,
  baseGateImpactContracts,
  gateCheckInputFingerprint,
  gateCheckToolFingerprints,
  releaseGateCheckIds
} from "./impact-catalog.ts";
import {
  captureGateWorkspaceSnapshot,
  type GateWorkspaceSnapshot
} from "./impact-snapshot.ts";
import type { CaptureDependencies } from "./impact-toolchain.ts";
import {
  activationFlagForTool,
  gateToolInputs,
  type GateToolId
} from "./impact-tools.ts";
import { compareText } from "./impact-values.ts";
import {
  readReceiptManifest,
  writeReceiptManifest
} from "./impact-receipts.ts";

export type GateActivationReason =
  | "cache-invalid"
  | "conservative-fallback"
  | "first-run"
  | "inputs-changed"
  | "release-full"
  | "snapshot-unavailable"
  | "unchanged-success"
  | "tool-triggered"
  | "prerequisite-triggered";

export type GateActivationDecision = Readonly<
  | {
      action: "execute";
      checkId: string;
      fingerprint: null;
      reason: "release-full" | "snapshot-unavailable" | "conservative-fallback";
    }
  | {
      action: "execute";
      checkId: string;
      fingerprint: string;
      reason:
        | "cache-invalid"
        | "conservative-fallback"
        | "first-run"
        | "inputs-changed"
        | "tool-triggered"
        | "prerequisite-triggered";
    }
  | {
      action: "reuse";
      checkId: string;
      fingerprint: string;
      reason: "unchanged-success";
    }
>;

type GateActivationPlanCommon = Readonly<{
  activeCheckIds: readonly string[];
  activeToolIds: readonly string[];
  cacheDirectory: string;
  decisions: readonly GateActivationDecision[];
}>;

export type GateActivationPlan =
  | (GateActivationPlanCommon &
      Readonly<{
        fallbackDetail: string;
        kind: "fallback";
        snapshot: null;
      }>)
  | (GateActivationPlanCommon &
      Readonly<{
        kind: "incremental";
        snapshot: GateWorkspaceSnapshot;
      }>)
  | (GateActivationPlanCommon &
      Readonly<{
        kind: "release";
        snapshot: GateWorkspaceSnapshot | null;
      }>);

export type GateReceiptPublication = Readonly<
  | { published: true; receiptCount: number }
  | {
      detail: string;
      published: false;
      reason: "publication-failed" | "snapshot-unavailable";
    }
  | {
      published: false;
      reason:
        | "check-not-passed"
        | "not-incremental"
        | "workspace-drift"
        | "inputs-unclosed";
    }
>;

type PrepareGateActivationOptions = Readonly<{
  cacheDirectory?: string;
  captureDependencies?: CaptureDependencies;
  release: boolean;
  workspaceRoot?: string;
}>;

function releasePlan(cacheDirectory: string): GateActivationPlan {
  const decisions = releaseGateCheckIds.map((checkId) => ({
    action: "execute" as const,
    checkId,
    fingerprint: null,
    reason: "release-full" as const
  }));
  return {
    activeCheckIds: releaseGateCheckIds,
    activeToolIds: Object.keys(gateToolInputs),
    cacheDirectory,
    decisions,
    kind: "release",
    snapshot: null
  };
}

function fallbackPlan(
  cacheDirectory: string,
  detail: string
): GateActivationPlan {
  return {
    activeCheckIds: baseGateCheckIds,
    activeToolIds: Object.keys(gateToolInputs),
    cacheDirectory,
    decisions: baseGateCheckIds.map((checkId) => ({
      action: "execute" as const,
      checkId,
      fingerprint: null,
      reason: "snapshot-unavailable" as const
    })),
    fallbackDetail: detail,
    kind: "fallback",
    snapshot: null
  };
}

export async function prepareGateActivation(
  options: PrepareGateActivationOptions
): Promise<GateActivationPlan> {
  const workspaceRoot = options.workspaceRoot ?? rootDir;
  const cacheDirectory =
    options.cacheDirectory ??
    path.join(workspaceRoot, ".log/vibe-check/cache/project-tool-receipts-v5");
  if (options.release) return releasePlan(cacheDirectory);
  let snapshot: GateWorkspaceSnapshot;
  try {
    snapshot = await captureGateWorkspaceSnapshot(
      workspaceRoot,
      options.captureDependencies
    );
  } catch (error) {
    return fallbackPlan(
      cacheDirectory,
      operationErrorDetail(error) ?? "workspace snapshot failed"
    );
  }
  const receiptRead = await readReceiptManifest(cacheDirectory);
  const receipts = new Map(
    receiptRead.manifest?.receipts.map((receipt) => [
      receipt.checkId,
      receipt
    ]) ?? []
  );
  const changedToolIds = new Set<GateToolId>();
  const candidates: readonly GateActivationDecision[] =
    baseGateImpactContracts.map((contract_) => {
      if (
        snapshot.unclassifiedPaths.length > 0 ||
        contract_.toolIds.length === 0 ||
        contract_.toolIds.some(
          (toolId) => snapshot.toolInputDigests[toolId] === undefined
        )
      ) {
        for (const toolId of contract_.toolIds) changedToolIds.add(toolId);
        return {
          action: "execute" as const,
          checkId: contract_.checkId,
          fingerprint: null,
          reason: "conservative-fallback" as const
        };
      }
      const fingerprint = gateCheckInputFingerprint(contract_, snapshot);
      const receipt = receipts.get(contract_.checkId);
      const toolFingerprints = gateCheckToolFingerprints(contract_, snapshot);
      if (
        receipt?.fingerprint === fingerprint &&
        Object.keys(receipt.toolFingerprints).length ===
          contract_.toolIds.length &&
        contract_.toolIds.every(
          (toolId) =>
            receipt.toolFingerprints[toolId] === toolFingerprints[toolId]
        )
      ) {
        return {
          action: "reuse" as const,
          checkId: contract_.checkId,
          fingerprint,
          reason: "unchanged-success" as const
        };
      }
      const changed = contract_.toolIds.filter(
        (toolId) =>
          receipt?.toolFingerprints[toolId] !== toolFingerprints[toolId]
      );
      // A missing proof or non-component contract change cannot justify a narrower trigger.
      for (const toolId of changed.length > 0 ? changed : contract_.toolIds)
        changedToolIds.add(toolId);
      const reason: GateActivationReason =
        receiptRead.state === "invalid"
          ? "cache-invalid"
          : receipt === undefined
            ? "first-run"
            : "inputs-changed";
      return {
        action: "execute" as const,
        checkId: contract_.checkId,
        fingerprint,
        reason
      };
    });
  const toolDecisions: readonly GateActivationDecision[] = candidates.map(
    (decision, index) => {
      if (decision.action === "execute") return decision;
      return baseGateImpactContracts[index]!.toolIds.some((toolId) =>
        changedToolIds.has(toolId)
      )
        ? { ...decision, action: "execute", reason: "tool-triggered" }
        : decision;
    }
  );
  // Mirror only the catalog's declared success prerequisites for truthful plan
  // diagnostics/publication. Vibe still owns selection, scheduling and execution.
  const executing = new Set(
    toolDecisions
      .filter(({ action }) => action === "execute")
      .map(({ checkId }) => checkId)
  );
  const contracts = new Map(
    baseGateImpactContracts.map((contract_) => [contract_.checkId, contract_])
  );
  for (const checkId of executing)
    for (const dependency of contracts.get(checkId)?.dependsOn ?? [])
      if (contracts.has(dependency)) executing.add(dependency);
  const decisions: readonly GateActivationDecision[] = toolDecisions.map(
    (decision) =>
      decision.action === "reuse" && executing.has(decision.checkId)
        ? { ...decision, action: "execute", reason: "prerequisite-triggered" }
        : decision
  );
  return {
    activeCheckIds: decisions
      .filter(({ action }) => action === "execute")
      .map(({ checkId }) => checkId),
    activeToolIds: [...changedToolIds].sort(compareText),
    cacheDirectory,
    decisions,
    kind: "incremental",
    snapshot
  };
}

export function gateActivationFlags(
  plan: GateActivationPlan
): readonly string[] {
  return plan.activeToolIds.map(activationFlagForTool);
}

export async function publishGateReceipts(
  plan: GateActivationPlan,
  result: Readonly<{
    runSucceeded: boolean;
    passedCheckIds: ReadonlySet<string>;
  }>,
  workspaceRoot: string = rootDir,
  captureDependencies: CaptureDependencies = {}
): Promise<GateReceiptPublication> {
  if (plan.kind !== "incremental") {
    return { published: false, reason: "not-incremental" };
  }
  if (!result.runSucceeded)
    return { published: false, reason: "check-not-passed" };
  if (
    plan.decisions.some(
      ({ action, checkId }) =>
        action === "execute" && !result.passedCheckIds.has(checkId)
    )
  ) {
    return { published: false, reason: "check-not-passed" };
  }
  if (
    plan.snapshot.unclassifiedPaths.length > 0 ||
    plan.decisions.some(({ fingerprint }) => fingerprint === null)
  )
    return { published: false, reason: "inputs-unclosed" };
  let finalSnapshot: GateWorkspaceSnapshot;
  try {
    finalSnapshot = await captureGateWorkspaceSnapshot(
      workspaceRoot,
      captureDependencies
    );
  } catch (error) {
    return {
      detail: operationErrorDetail(error) ?? "final workspace snapshot failed",
      published: false,
      reason: "snapshot-unavailable"
    };
  }
  if (
    finalSnapshot.workspaceFingerprint !== plan.snapshot.workspaceFingerprint
  ) {
    return { published: false, reason: "workspace-drift" };
  }
  const receipts = plan.decisions
    .filter(
      (
        decision
      ): decision is GateActivationDecision & { fingerprint: string } =>
        decision.fingerprint !== null
    )
    .map(({ checkId, fingerprint }) => ({
      checkId,
      fingerprint,
      outcome: "passed" as const,
      toolFingerprints: gateCheckToolFingerprints(
        baseGateImpactContracts.find(
          (contract_) => contract_.checkId === checkId
        )!,
        plan.snapshot
      )
    }))
    .sort((left, right) => compareText(left.checkId, right.checkId));
  try {
    await writeReceiptManifest(plan.cacheDirectory, receipts);
    return { published: true, receiptCount: receipts.length };
  } catch (error) {
    return {
      detail: operationErrorDetail(error) ?? "receipt publication failed",
      published: false,
      reason: "publication-failed"
    };
  }
}
