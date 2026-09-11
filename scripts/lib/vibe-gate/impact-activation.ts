import path from "node:path";
import { operationErrorDetail } from "../../../tools/shared/src/node/error-detail.ts";
import { rootDir } from "../project.ts";
import { semanticGateChecks } from "./checks/semantic.ts";
import {
  baseGateCheckIds,
  baseGateImpactContracts,
  gateCheckInputFingerprint,
  releaseGateCheckIds
} from "./impact-catalog.ts";
import {
  captureGateWorkspaceSnapshot,
  type GateWorkspaceSnapshot
} from "./impact-snapshot.ts";
import type { CaptureDependencies } from "./impact-toolchain.ts";
import { compareText } from "./impact-values.ts";
import {
  readReceiptManifest,
  writeReceiptManifest
} from "./impact-receipts.ts";

export type GateActivationReason =
  | "cache-invalid"
  | "conservative-fallback"
  | "dependency-required"
  | "first-run"
  | "inputs-changed"
  | "release-full"
  | "snapshot-unavailable"
  | "unchanged-success";

export type GateActivationDecision = Readonly<
  | {
      action: "execute";
      checkId: string;
      fingerprint: null;
      reason: "release-full" | "snapshot-unavailable";
    }
  | {
      action: "execute";
      checkId: string;
      fingerprint: string;
      reason:
        | "cache-invalid"
        | "conservative-fallback"
        | "dependency-required"
        | "first-run"
        | "inputs-changed";
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
      reason: "check-not-passed" | "not-incremental" | "workspace-drift";
    }
>;

type PrepareGateActivationOptions = Readonly<{
  cacheDirectory?: string;
  captureDependencies?: CaptureDependencies;
  release: boolean;
  workspaceRoot?: string;
}>;

function baseDependencyMap(): ReadonlyMap<string, readonly string[]> {
  return new Map(
    semanticGateChecks.map(
      (check) =>
        [check.checkId, "dependsOn" in check ? check.dependsOn : []] as const
    )
  );
}

function closeRequiredDependencies(
  decisions: readonly GateActivationDecision[]
): readonly GateActivationDecision[] {
  const byCheckId = new Map(
    decisions.map((decision) => [decision.checkId, decision])
  );
  const dependencies = baseDependencyMap();
  const visit = (checkId: string): void => {
    for (const dependency of dependencies.get(checkId) ?? []) {
      const decision = byCheckId.get(dependency);
      if (decision?.action === "reuse") {
        byCheckId.set(dependency, {
          ...decision,
          action: "execute",
          reason: "dependency-required"
        });
      }
      visit(dependency);
    }
  };
  for (const decision of decisions) {
    if (decision.action === "execute") visit(decision.checkId);
  }
  return decisions.map(
    (decision) => byCheckId.get(decision.checkId) ?? decision
  );
}

function releasePlan(
  cacheDirectory: string,
  snapshot: GateWorkspaceSnapshot | null
): GateActivationPlan {
  const decisions = releaseGateCheckIds.map((checkId) => ({
    action: "execute" as const,
    checkId,
    fingerprint: null,
    reason: "release-full" as const
  }));
  return {
    activeCheckIds: releaseGateCheckIds,
    cacheDirectory,
    decisions,
    kind: "release",
    snapshot
  };
}

function fallbackPlan(
  cacheDirectory: string,
  detail: string
): GateActivationPlan {
  return {
    activeCheckIds: baseGateCheckIds,
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
    path.join(workspaceRoot, ".log/vibe-check/cache/incremental-gate-v2");
  let snapshot: GateWorkspaceSnapshot;
  try {
    snapshot = await captureGateWorkspaceSnapshot(
      workspaceRoot,
      options.captureDependencies
    );
  } catch (error) {
    if (options.release) return releasePlan(cacheDirectory, null);
    return fallbackPlan(
      cacheDirectory,
      operationErrorDetail(error) ?? "workspace snapshot failed"
    );
  }
  if (options.release) return releasePlan(cacheDirectory, snapshot);
  const receiptRead = await readReceiptManifest(cacheDirectory);
  const receipts = new Map(
    receiptRead.manifest?.receipts.map((receipt) => [
      receipt.checkId,
      receipt
    ]) ?? []
  );
  const rawDecisions = baseGateImpactContracts.map((contract_) => {
    const fingerprint = gateCheckInputFingerprint(contract_, snapshot);
    const receipt = receipts.get(contract_.checkId);
    if (receipt?.fingerprint === fingerprint) {
      return {
        action: "reuse" as const,
        checkId: contract_.checkId,
        fingerprint,
        reason: "unchanged-success" as const
      };
    }
    const reason: GateActivationReason =
      receiptRead.state === "invalid"
        ? "cache-invalid"
        : receipt === undefined
          ? "first-run"
          : snapshot.unclassifiedPaths.length > 0
            ? "conservative-fallback"
            : "inputs-changed";
    return {
      action: "execute" as const,
      checkId: contract_.checkId,
      fingerprint,
      reason
    };
  });
  const decisions = closeRequiredDependencies(rawDecisions);
  return {
    activeCheckIds: decisions
      .filter(({ action }) => action === "execute")
      .map(({ checkId }) => checkId),
    cacheDirectory,
    decisions,
    kind: "incremental",
    snapshot
  };
}

export function activationFlagForCheck(checkId: string): string {
  return `gate-activation:${checkId}`;
}

export function gateActivationFlags(
  plan: GateActivationPlan
): readonly string[] {
  return plan.activeCheckIds.map(activationFlagForCheck);
}

export async function publishGateReceipts(
  plan: GateActivationPlan,
  passedCheckIds: ReadonlySet<string>,
  workspaceRoot: string = rootDir,
  captureDependencies: CaptureDependencies = {}
): Promise<GateReceiptPublication> {
  if (plan.kind !== "incremental") {
    return { published: false, reason: "not-incremental" };
  }
  if (
    plan.decisions.some(
      ({ action, checkId }) =>
        action === "execute" && !passedCheckIds.has(checkId)
    )
  ) {
    return { published: false, reason: "check-not-passed" };
  }
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
      outcome: "passed" as const
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
