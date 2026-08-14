export type CheckProfile = "full" | "quick";

export type CheckTask = {
  minimumProfile: CheckProfile;
  script: string;
};

export const checkPreflightTasks = [
  { minimumProfile: "full", script: "test:decision-records-cli" },
  { minimumProfile: "full", script: "test:version-control" },
  { minimumProfile: "full", script: "test:skill-package-hash" },
  { minimumProfile: "full", script: "test:investigation-report-check" },
  { minimumProfile: "full", script: "test:test-evidence-cli" },
  { minimumProfile: "full", script: "test:task-graph-cli" },
  { minimumProfile: "quick", script: "test:change-plan-cli" },
  { minimumProfile: "quick", script: "test:skill-release-publisher" },
  { minimumProfile: "quick", script: "test:index-runtime" },
  { minimumProfile: "quick", script: "test:skill-validator" },
  { minimumProfile: "quick", script: "check:investigations" },
  { minimumProfile: "quick", script: "check:decisions" },
  { minimumProfile: "quick", script: "validate" },
  { minimumProfile: "quick", script: "test:skill-updater" },
  { minimumProfile: "quick", script: "check:test-evidence-cli" },
  { minimumProfile: "quick", script: "check:test-evidence-catalog" },
  { minimumProfile: "quick", script: "check:skill-validator" },
  { minimumProfile: "quick", script: "check:investigation-report-check" },
  { minimumProfile: "quick", script: "check:change-plan-cli" },
  { minimumProfile: "quick", script: "check:decision-records-cli" },
  { minimumProfile: "quick", script: "check:task-graph-index" },
  { minimumProfile: "quick", script: "check:task-graph-cli" },
  { minimumProfile: "quick", script: "typecheck" },
  { minimumProfile: "quick", script: "check:skill-updaters" },
  { minimumProfile: "quick", script: "test:check" },
  { minimumProfile: "quick", script: "test:environment" },
  { minimumProfile: "quick", script: "test:generated-file" },
  { minimumProfile: "quick", script: "hash:skills" }
] as const satisfies readonly CheckTask[];

export const checkPackageScript = "pack:skills";

export function checkTaskScript(task: CheckTask): string {
  return task.script;
}

export function checkTaskRunsInProfile(
  task: CheckTask,
  profile: CheckProfile
): boolean {
  return profile === "full" || task.minimumProfile === "quick";
}

export const checkPackageScripts = [
  ...checkPreflightTasks.map(checkTaskScript),
  checkPackageScript
] as const;
