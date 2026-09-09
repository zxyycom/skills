import type { GateWorkspaceSnapshot } from "./impact.ts";

export function fixtureGateWorkspaceSnapshot(): GateWorkspaceSnapshot {
  const digest = "0".repeat(64);
  return {
    files: [],
    tagDigests: {
      "build-system": digest,
      "change-plan": digest,
      "decision-records": digest,
      documentation: digest,
      environment: digest,
      global: digest,
      "index-runtime": digest,
      "investigation-report": digest,
      json: digest,
      "maintained-code": digest,
      markdown: digest,
      "path-inventory": digest,
      "secret-surface": digest,
      "shared-tools": digest,
      "skill-release": digest,
      "skill-updater": digest,
      "skill-validator": digest,
      skills: digest,
      "task-graph": digest,
      "test-evidence": digest
    },
    toolchainFingerprint: digest,
    unclassifiedPaths: [],
    workspaceFingerprint: digest
  };
}
