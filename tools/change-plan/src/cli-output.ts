import {
  changePlanArtifactNames,
  type ChangePlanCheckResult,
  type ChangePlanDiagnostic,
  type GitDistanceEvidence
} from "./types.ts";
import type { ChangePlanCliIo } from "./cli.ts";

export function helpText(): string {
  return [
    "Usage:",
    "  change-plan.mjs list [change-root] [--stage <stage>] [--json]",
    "  change-plan.mjs show <change-directory> [--json]",
    "  change-plan.mjs check <change-directory> [--json]",
    "  change-plan.mjs check-all [change-root] [--json]",
    "  change-plan.mjs plan <change-directory> [--json]",
    "  change-plan.mjs complete <change-directory> [--preflight] [--json]",
    "",
    "Manage active Draft and Plan artifacts, checks, Git distance, and complete-and-delete delivery.",
    "Check commands apply mechanical gates only; they do not approve plans or judge semantics.",
    "Complete is destructive: obtain current task authorization and finish owner handoff before running it.",
    "",
    "Options:",
    "  --stage      List changes in draft or plan stage",
    "  --preflight  Check completion and deletion preparation without writing",
    "  --json       Write the structured result to stdout",
    "  -h, --help   Show this help"
  ].join("\n");
}
export function formatGitDistance(evidence: GitDistanceEvidence): string {
  return evidence.commitCount === 0 && evidence.changedLines === 0
    ? "自计划基线以来，未统计到 Change 目录外的项目变化。"
    : `距离计划基线已过去 ${evidence.commitCount} 个提交，Change 目录外累计变化 ${evidence.changedLines} 行；继续前请确认这些变化没有影响当前计划。`;
}
export function printDiagnostics(
  prefix: string,
  result: ChangePlanCheckResult,
  io: ChangePlanCliIo
): void {
  writeLine(io.stderr, `${prefix} (${result.changeDirectory}):`);
  for (const entry of result.diagnostics)
    writeLine(io.stderr, formatDiagnostic(entry));
}
export function printArtifacts(
  artifacts: Record<string, string | null>,
  io: ChangePlanCliIo
): void {
  for (const artifact of changePlanArtifactNames) {
    writeLine(io.stdout, "");
    writeLine(io.stdout, `--- ${artifact} ---`);
    writeLine(
      io.stdout,
      artifacts[artifact]?.trimEnd() ?? "[missing or unreadable]"
    );
  }
}
export function writeLine(writer: (text: string) => void, text: string): void {
  writer(`${text}\n`);
}
export function formatDiagnostic(diagnostic: ChangePlanDiagnostic): string {
  const location =
    diagnostic.file === null
      ? ""
      : `${diagnostic.file}${diagnostic.line === undefined ? "" : `:${diagnostic.line}`}: `;
  return `- ${location}[${diagnostic.code}] ${diagnostic.message}`;
}
