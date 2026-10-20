import { commandCheck } from "@zxyycom/vibe-check";
import {
  externalProcessClaim,
  gateCheckDeclaration,
  gateEnvironmentCheckId,
  type GateCheckConfiguration
} from "../contracts.ts";
import { gateCommandPolicy } from "../command-runner.ts";

export { gateEnvironmentCheckId } from "../contracts.ts";

export function createGateEnvironmentCheck(
  configuration: GateCheckConfiguration = {}
) {
  return commandCheck({
    checkId: gateEnvironmentCheckId,
    displayName: "Gate environment prerequisites",
    ...gateCheckDeclaration(
      gateEnvironmentCheckId,
      configuration,
      externalProcessClaim
    ),
    ...gateCommandPolicy,
    executable: "node",
    arguments: ["scripts/environment.js", "gate"],
    timeoutMs: 30_000,
    outputByteLimit: 1024 * 1024
  });
}
