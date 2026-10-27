import fs from "node:fs/promises";
import path from "node:path";
import type { GateSelectedOutcome } from "./selection.ts";
import { releaseRequiredCheckIds } from "./definition.ts";
import {
  publicGateDiagnostic,
  type GateInputClosureDiagnostic
} from "./diagnostics.ts";
import type {
  GateActivationPlan,
  GateReceiptPublication
} from "./impact-activation.ts";
import type { GateScope } from "./profiles.ts";

type GateActivationScope = Exclude<GateScope, "quick" | "selected">;

type GateIncrementalSummary = Readonly<{
  counts: GateActivationCounts;
  activeToolIds: readonly string[];
  decisions: GateActivationPlan["decisions"];
  fallbackDetail: string | null;
  unclosedInputs: GateInputClosureDiagnostic | null;
  mode: GateActivationPlan["kind"];
  publication: GateReceiptPublication;
}>;

type GateActivationCounts = Readonly<{
  execute: number;
  fallback: number;
  firstRun: number;
  reuse: number;
}>;

export function describeSelectedGateOutcome(
  outcome: GateSelectedOutcome | null
): string {
  if (outcome === null)
    return "Vibe Check selected scope: native selection facts unavailable; no repository-wide success is proved.";
  return (
    `Vibe Check selected scope execution: ${outcome.executedCheckIds.join(", ") || "none"}. ` +
    `Additional success prerequisites: ${outcome.dependencyCheckIds.join(", ") || "none"}. ` +
    "This run covers only selected checks and prerequisites; success is not a repository-wide validation claim."
  );
}

function scopeActivationDecisions(
  plan: GateActivationPlan,
  scope: GateActivationScope
): GateActivationPlan["decisions"] {
  return plan.decisions.filter(
    ({ checkId }) =>
      scope !== "full" || releaseRequiredCheckIds.some((id) => id === checkId)
  );
}

function activationCounts(
  plan: GateActivationPlan,
  scope: GateActivationScope
): GateActivationCounts {
  const decisions = scopeActivationDecisions(plan, scope);
  const execute = decisions.filter(({ action }) => action === "execute").length;
  const reuse = decisions.length - execute;
  const firstRun = decisions.filter(
    ({ reason }) => reason === "first-run"
  ).length;
  const fallback = decisions.filter(({ reason }) =>
    ["cache-invalid", "conservative-fallback", "snapshot-unavailable"].includes(
      reason
    )
  ).length;
  return {
    execute,
    fallback,
    firstRun,
    reuse
  };
}

export function describeActivationPlan(
  plan: GateActivationPlan,
  unclosedInputs: GateInputClosureDiagnostic | null,
  scope: GateActivationScope
): string {
  const counts = activationCounts(plan, scope);
  const summary = `Vibe Check ${scope} input plan: ${plan.kind}; execute ${counts.execute}, reuse ${counts.reuse}, fallback ${counts.fallback}, first-run ${counts.firstRun}.`;
  if (plan.kind === "fallback")
    return `${summary} Snapshot fallback: ${publicGateDiagnostic(plan.fallbackDetail)}.`;
  if (unclosedInputs === null || unclosedInputs.total === 0) return summary;
  const entries = unclosedInputs.entries
    .map((entry) => `${entry.path} (${entry.reason})`)
    .join("; ");
  const omitted =
    unclosedInputs.omittedCount > 0
      ? `; ${unclosedInputs.omittedCount} more omitted`
      : "";
  return `${summary} Inputs unclosed (${unclosedInputs.total}): ${entries}${omitted}.`;
}

async function writeIncrementalSummary(
  invocationDirectory: string,
  summary: GateIncrementalSummary
): Promise<string> {
  const summaryPath = path.join(
    invocationDirectory,
    "machine",
    "gate-incremental.json"
  );
  await fs.mkdir(path.dirname(summaryPath), { recursive: true });
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  return summaryPath;
}

type GateActivationOutputOptions = Readonly<{
  plan: GateActivationPlan;
  scope: GateActivationScope;
  invocationDirectory: string;
  unclosedInputs: GateInputClosureDiagnostic | null;
  publication: GateIncrementalSummary["publication"];
  reportInfo: (message: string) => void;
}>;

// 仅发布安全、有界的观测摘要；成功证明授权与发布仍由 CLI / receipt owner 承担。
export async function reportGateActivationOutcome(
  options: GateActivationOutputOptions
): Promise<void> {
  const {
    plan,
    scope,
    invocationDirectory,
    unclosedInputs,
    publication,
    reportInfo
  } = options;
  try {
    const summaryPath = await writeIncrementalSummary(invocationDirectory, {
      counts: activationCounts(plan, scope),
      activeToolIds: plan.activeToolIds,
      decisions: scopeActivationDecisions(plan, scope),
      fallbackDetail:
        plan.kind === "fallback"
          ? publicGateDiagnostic(plan.fallbackDetail)
          : null,
      unclosedInputs,
      mode: plan.kind,
      publication:
        "detail" in publication
          ? {
              ...publication,
              detail: publicGateDiagnostic(publication.detail)
            }
          : publication
    });
    reportInfo(`Vibe Check incremental summary: ${summaryPath}`);
  } catch {
    reportInfo(
      "Vibe Check incremental summary unavailable; Gate outcomes are unchanged."
    );
  }
  if (!publication.published) {
    if (publication.reason === "workspace-drift") {
      reportInfo(
        "Vibe Check receipts not published because the workspace changed during the run."
      );
    } else if ("detail" in publication) {
      reportInfo(
        `Vibe Check receipts not published (${publication.reason}): ${publicGateDiagnostic(publication.detail)}.`
      );
    }
  }
}
