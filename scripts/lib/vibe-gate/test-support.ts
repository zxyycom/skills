import type { GateWorkspaceSnapshot } from "./impact.ts";

export function fixtureGateWorkspaceSnapshot(): GateWorkspaceSnapshot {
  const digest = "0".repeat(64);
  return {
    files: [],
    toolInputDigests: {},
    toolchainFingerprint: digest,
    unclassifiedPaths: [],
    workspaceFingerprint: digest
  };
}
