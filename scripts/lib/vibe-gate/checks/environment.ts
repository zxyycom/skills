import { defineCheck } from "@zxyycom/vibe-check";
import type { Check } from "@zxyycom/vibe-check";
import { externalProcessClaim } from "../contracts.ts";
import {
  executeGateCommand,
  type GateCommandRunner
} from "../command-runner.ts";

export const gateEnvironmentCheckId = "gate-environment";

export function createGateEnvironmentCheck(runner: GateCommandRunner): Check {
  return defineCheck({
    checkId: gateEnvironmentCheckId,
    displayName: "Gate environment prerequisites",
    resourceClaims: externalProcessClaim,
    async execution({ artifactDirectory, project, signal }) {
      return await executeGateCommand({
        artifactDirectory,
        command: {
          args: ["scripts/environment.js", "gate"],
          command: "node"
        },
        context: { kind: "gate-command" },
        projectRoot: project.root,
        runner,
        signal
      });
    }
  });
}
