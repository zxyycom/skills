export type CheckTask =
  | string
  | { blocking: true; script: string };

export const checkPreflightTasks = [
  "test:verification-evidence-cli",
  "test:change-plan-cli",
  "test:decision-records-cli",
  "test:index-runtime",
  "test:skill-validator",
  "test:investigation-report-check",
  "check:investigations",
  "check:decisions",
  "validate",
  "test:skill-updater",
  "check:verification-evidence-cli",
  "check:skill-validator",
  "check:investigation-report-check",
  "check:change-plan-cli",
  "check:decision-records-cli",
  "typecheck",
  "check:skill-updaters",
  "test:check",
  "test:generated-file",
  "test:skill-package-hash",
  "hash:skills",
  "test:version-control"
] as const satisfies readonly CheckTask[];

export const checkPackageScript = "pack:skills";

export function checkTaskScript(task: CheckTask): string {
  return typeof task === "string" ? task : task.script;
}

export const checkPackageScripts = [
  ...checkPreflightTasks.map(checkTaskScript),
  checkPackageScript
] as const;
