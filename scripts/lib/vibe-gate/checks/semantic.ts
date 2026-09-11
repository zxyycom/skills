import { defineCheck } from "@zxyycom/vibe-check";
import type { Check } from "@zxyycom/vibe-check";
import { externalProcessClaim, type GateTag } from "../contracts.ts";
import {
  executeGateCommand,
  type GateCommand,
  type GateCommandRunner
} from "../command-runner.ts";
import type { GatePackageScriptCheckId } from "./package-script.ts";

export type SemanticGateCheck = Readonly<{
  checkId: `test:${string}`;
  command: GateCommand;
  dependsOn?: readonly GatePackageScriptCheckId[];
  displayName: string;
  requiredTag?: GateTag;
}>;

const bunTest = (file: string): GateCommand => ({
  args: ["test", file],
  command: "bun"
});

export const semanticGateChecks = [
  {
    checkId: "test:change-plan:artifact-and-active-plan-gates",
    displayName: "Change Plan artifact and active-plan gates",
    requiredTag: undefined,
    command: bunTest(
      "./tools/change-plan/tests/checks/artifact-and-active-plan-gates.ts"
    )
  },
  {
    checkId: "test:change-plan:lifecycle-complete",
    displayName: "Change Plan lifecycle and complete",
    requiredTag: undefined,
    command: bunTest("./tools/change-plan/tests/checks/lifecycle-complete.ts")
  },
  {
    checkId: "test:change-plan:public-distribution",
    dependsOn: ["script:check:change-plan-cli"],
    displayName: "Change Plan public distribution",
    requiredTag: undefined,
    command: bunTest("./tools/change-plan/tests/checks/public-distribution.ts")
  },
  {
    checkId: "test:decision-records:record-and-established-graph",
    displayName: "Decision Records record and established graph",
    requiredTag: undefined,
    command: bunTest(
      "./tools/decision-records/tests/checks/record-and-established-graph.ts"
    )
  },
  {
    checkId: "test:decision-records:query-and-index-projection",
    displayName: "Decision Records query and index projection",
    requiredTag: undefined,
    command: bunTest(
      "./tools/decision-records/tests/checks/query-and-index-projection.ts"
    )
  },
  {
    checkId: "test:decision-records:lifecycle-and-recovery",
    displayName: "Decision Records lifecycle and recovery",
    requiredTag: undefined,
    command: bunTest(
      "./tools/decision-records/tests/checks/lifecycle-and-recovery.ts"
    )
  },
  {
    checkId: "test:decision-records:pending-stage",
    displayName: "Decision Records pending stage",
    requiredTag: undefined,
    command: bunTest("./tools/decision-records/tests/stage.test.ts")
  },
  {
    checkId: "test:decision-records:public-distribution",
    dependsOn: ["script:check:decision-records-cli"],
    displayName: "Decision Records public distribution",
    requiredTag: undefined,
    command: bunTest(
      "./tools/decision-records/tests/checks/public-distribution.ts"
    )
  },
  {
    checkId: "test:investigation-report:collection-and-resources",
    displayName: "Investigation Report collection and resources",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/collection-and-resources.ts"
    )
  },
  {
    checkId: "test:investigation-report:index-and-query",
    displayName: "Investigation Report index and query",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/index-and-query.ts"
    )
  },
  {
    checkId: "test:investigation-report:transactional-maintenance",
    displayName: "Investigation Report transactional maintenance",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/transactional-maintenance.ts"
    )
  },
  {
    checkId: "test:investigation-report:pending-stage",
    displayName: "Investigation Report pending stage",
    requiredTag: undefined,
    command: bunTest("./tools/investigation-report/tests/staging.test.ts")
  },
  {
    checkId: "test:investigation-report:cli-contract",
    displayName: "Investigation Report CLI contract",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/cli-contract.ts"
    )
  },
  {
    checkId: "test:task-graph:index-and-projection",
    displayName: "Task Graph index and projection",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/index-and-projection.ts")
  },
  {
    checkId: "test:task-graph:task-lifecycle",
    displayName: "Task Graph task lifecycle",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/task-lifecycle.ts")
  },
  {
    checkId: "test:task-graph:runtime-and-store",
    displayName: "Task Graph runtime and store",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/runtime-and-store.ts")
  },
  {
    checkId: "test:task-graph:native-store",
    displayName: "Task Graph native store",
    requiredTag: undefined,
    command: {
      command: "node",
      args: ["--test", "./tools/task-graph/tests/native-store.test.ts"]
    }
  },
  {
    checkId: "test:task-graph:cli-rendering",
    displayName: "Task Graph CLI rendering",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/cli-rendering.ts")
  },
  {
    checkId: "test:task-graph:pending-stage",
    displayName: "Task Graph pending stage",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/staging.test.ts")
  },
  {
    checkId: "test:task-graph:public-distribution",
    dependsOn: ["script:check:task-graph-cli"],
    displayName: "Task Graph public distribution",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/public-distribution.ts")
  },
  {
    checkId: "test:task-graph:portable-build",
    displayName: "Task Graph portable build",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/portable-build.test.ts")
  },
  {
    checkId: "test:test-evidence:case-runtime",
    displayName: "Test Evidence Case runtime",
    requiredTag: undefined,
    command: bunTest("./tools/test-evidence/tests/core.test.ts")
  },
  {
    checkId: "test:test-evidence:public-boundary",
    displayName: "Test Evidence public API and CLI boundary",
    requiredTag: undefined,
    command: bunTest("./tools/test-evidence/tests/public-boundary.test.ts")
  },
  {
    checkId: "test:test-evidence:project-snapshot",
    displayName: "Test Evidence project snapshot producer",
    requiredTag: undefined,
    command: bunTest("./scripts/test-evidence/snapshot.test.ts")
  },
  {
    checkId: "test:test-evidence:project-reference-check",
    displayName: "Test Evidence project reference check",
    requiredTag: undefined,
    command: bunTest("./scripts/test-evidence/check.test.ts")
  },
  {
    checkId: "test:test-evidence:migration",
    displayName: "Test Evidence migration",
    requiredTag: undefined,
    command: bunTest("./scripts/test-evidence/migrate.test.ts")
  }
] as const satisfies readonly SemanticGateCheck[];

export function createSemanticGateCheck(
  check: SemanticGateCheck,
  runner: GateCommandRunner
): Check {
  return defineCheck({
    checkId: check.checkId,
    ...(check.dependsOn === undefined ? {} : { dependsOn: check.dependsOn }),
    displayName: check.displayName,
    resourceClaims: externalProcessClaim,
    async execution({ artifactDirectory, project, signal }) {
      return await executeGateCommand({
        artifactDirectory,
        command: check.command,
        projectRoot: project.root,
        runner,
        context: { kind: "semantic" },
        signal
      });
    }
  });
}
