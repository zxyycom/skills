import { commandCheck } from "@zxyycom/vibe-check";
import {
  externalProcessClaim,
  gateCheckDeclaration,
  projectActivationCondition,
  type GateCheckConfiguration,
  type GateTag
} from "../contracts.ts";
import { gateCommandPolicy, type GateCommand } from "../command-runner.ts";
import type { GateToolSubscription } from "../impact-tools.ts";
import type { GatePackageScriptCheckId } from "./package-script.ts";

export type SemanticGateCheck = Readonly<{
  checkId: `test:${string}`;
  toolIds: GateToolSubscription;
  command: GateCommand;
  dependsOn?: readonly GatePackageScriptCheckId[];
  generationSkillNames?: readonly string[];
  displayName: string;
  requiredTag?: GateTag;
}>;

const bunTest = (file: string): GateCommand => ({
  args: ["test", file],
  command: "bun"
});

export const semanticGateChecks = [
  {
    checkId: "test:video-understanding:source-contracts",
    toolIds: ["video-understanding"],
    displayName: "Video Understanding source contracts",
    requiredTag: undefined,
    command: bunTest(
      "./tools/video-understanding/tests/checks/source-contracts.ts"
    )
  },
  {
    checkId: "test:video-understanding:source-cli",
    toolIds: ["video-understanding"],
    displayName: "Video Understanding source CLI",
    requiredTag: undefined,
    command: bunTest("./tools/video-understanding/tests/checks/source-cli.ts")
  },
  {
    checkId: "test:video-understanding:public-distribution",
    toolIds: ["video-understanding"],
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["video-understanding"],
    displayName: "Video Understanding public distribution",
    requiredTag: undefined,
    command: bunTest(
      "./tools/video-understanding/tests/checks/public-distribution.ts"
    )
  },
  {
    checkId: "test:novel-cards:card-and-query-contract",
    toolIds: ["novel-cards"],
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["novel-cards"],
    displayName: "Novel Cards runtime, history and transactions",
    requiredTag: undefined,
    command: bunTest(
      "./tools/novel-cards/tests/checks/card-and-query-contract.ts"
    )
  },
  {
    checkId: "test:lightweight-judgment:request-and-response",
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["lightweight-judgment"],
    toolIds: ["lightweight-judgment"],
    displayName:
      "Lightweight Judgment requests, responses, logs and migrations",
    requiredTag: undefined,
    command: bunTest(
      "./tools/lightweight-judgment/tests/checks/request-and-response.ts"
    )
  },
  {
    checkId: "test:lightweight-judgment:public-distribution",
    toolIds: ["lightweight-judgment"],
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["lightweight-judgment"],
    displayName: "Lightweight Judgment standalone distribution",
    requiredTag: undefined,
    command: bunTest(
      "./tools/lightweight-judgment/tests/checks/public-distribution.ts"
    )
  },
  {
    checkId: "test:change-plan:artifact-and-active-plan-gates",
    toolIds: ["change-plan"],
    displayName: "Change Plan artifact and active-plan gates",
    requiredTag: undefined,
    command: bunTest(
      "./tools/change-plan/tests/checks/artifact-and-active-plan-gates.ts"
    )
  },
  {
    checkId: "test:change-plan:lifecycle-finalize",
    toolIds: ["change-plan"],
    displayName: "Change Plan lifecycle and finalization",
    requiredTag: undefined,
    command: bunTest("./tools/change-plan/tests/checks/lifecycle-finalize.ts")
  },
  {
    checkId: "test:change-plan:public-distribution",
    toolIds: ["change-plan"],
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["change-plan"],
    displayName: "Change Plan public distribution",
    requiredTag: undefined,
    command: bunTest("./tools/change-plan/tests/checks/public-distribution.ts")
  },
  {
    checkId: "test:record-operations:shared-contract",
    toolIds: [
      "record-operations",
      "record-operations-tests",
      "record-reader-distribution"
    ],
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["decision-records", "investigation-report"],
    displayName: "Record Operations shared transactions and readers",
    requiredTag: undefined,
    command: bunTest(
      "./tools/record-operations/tests/checks/shared-contract.ts"
    )
  },
  {
    checkId: "test:decision-records:record-and-established-graph",
    // The current acquisition regression includes a real source sync-index
    // call. Its CLI module closure remains an input while that node is here.
    toolIds: [
      "decision-record-tests",
      "decision-record",
      "decision-query",
      "decision-maintenance",
      "decision-stage",
      "decision-cli",
      "file-text-search",
      "relation-graph"
    ],
    displayName: "Decision Records record and established graph",
    requiredTag: undefined,
    command: bunTest(
      "./tools/decision-records/tests/checks/record-and-established-graph.ts"
    )
  },
  {
    checkId: "test:decision-records:query-and-index-projection",
    toolIds: [
      "decision-query-tests",
      "decision-record",
      "decision-query",
      "decision-maintenance",
      "decision-stage",
      "decision-cli",
      "file-text-search",
      "relation-graph"
    ],
    displayName: "Decision Records query and index projection",
    requiredTag: undefined,
    command: bunTest(
      "./tools/decision-records/tests/checks/query-and-index-projection.ts"
    )
  },
  {
    checkId: "test:decision-records:lifecycle-and-recovery",
    toolIds: [
      "decision-maintenance-tests",
      "decision-record",
      "decision-query",
      "decision-maintenance",
      "decision-stage",
      "decision-cli",
      "file-text-search",
      "relation-graph"
    ],
    displayName: "Decision Records lifecycle and recovery",
    requiredTag: undefined,
    command: bunTest(
      "./tools/decision-records/tests/checks/lifecycle-and-recovery.ts"
    )
  },
  {
    checkId: "test:decision-records:pending-stage",
    toolIds: [
      "decision-stage-tests",
      "decision-record",
      "decision-stage",
      "relation-graph"
    ],
    displayName: "Decision Records pending stage",
    requiredTag: undefined,
    command: bunTest("./tools/decision-records/tests/stage.test.ts")
  },
  {
    checkId: "test:decision-records:cli-contract",
    toolIds: [
      "decision-cli-tests",
      "decision-record",
      "decision-query",
      "decision-maintenance",
      "decision-stage",
      "decision-cli",
      "file-text-search",
      "record-search-output",
      "relation-graph"
    ],
    displayName: "Decision Records source CLI contract",
    requiredTag: undefined,
    command: bunTest("./tools/decision-records/tests/checks/cli-contract.ts")
  },
  {
    checkId: "test:decision-records:public-distribution",
    toolIds: [
      "decision-distribution-tests",
      "decision-record",
      "decision-query",
      "decision-maintenance",
      "decision-stage",
      "decision-cli",
      "decision-distribution",
      "file-text-search",
      "record-search-output",
      "relation-graph"
    ],
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["decision-records"],
    displayName: "Decision Records public distribution",
    requiredTag: undefined,
    command: bunTest(
      "./tools/decision-records/tests/checks/public-distribution.ts"
    )
  },
  {
    checkId: "test:investigation-report:collection-and-resources",
    toolIds: [
      "investigation-record-tests",
      "investigation-record",
      "investigation-maintenance",
      "investigation-query",
      "investigation-stage",
      "investigation-cli",
      "investigation-distribution",
      "file-text-search",
      "relation-graph"
    ],
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["investigation-report"],
    displayName: "Investigation Report collection and resources",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/collection-and-resources.ts"
    )
  },
  {
    checkId: "test:investigation-report:index-and-query",
    toolIds: [
      "investigation-query-tests",
      "investigation-record",
      "investigation-query",
      "investigation-maintenance",
      "investigation-stage",
      "file-text-search",
      "relation-graph"
    ],
    displayName: "Investigation Report index and query",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/index-and-query.ts"
    )
  },
  {
    checkId: "test:investigation-report:transactional-maintenance",
    toolIds: [
      "investigation-maintenance-tests",
      "investigation-record",
      "investigation-query",
      "investigation-maintenance",
      "file-text-search",
      "relation-graph"
    ],
    displayName: "Investigation Report transactional maintenance",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/transactional-maintenance.ts"
    )
  },
  {
    checkId: "test:investigation-report:pending-stage",
    toolIds: [
      "investigation-stage-tests",
      "investigation-record",
      "investigation-query",
      "investigation-maintenance",
      "investigation-stage",
      "file-text-search",
      "relation-graph"
    ],
    displayName: "Investigation Report pending stage",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/pending-stage.ts"
    )
  },
  {
    checkId: "test:investigation-report:cli-contract",
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["investigation-report"],
    toolIds: [
      "investigation-cli-tests",
      "investigation-record",
      "investigation-query",
      "investigation-maintenance",
      "investigation-stage",
      "investigation-cli",
      "investigation-distribution",
      "file-text-search",
      "record-search-output",
      "relation-graph"
    ],
    displayName: "Investigation Report CLI contract",
    requiredTag: undefined,
    command: bunTest(
      "./tools/investigation-report/tests/checks/cli-contract.ts"
    )
  },
  {
    checkId: "test:task-graph:index-and-projection",
    toolIds: ["task-graph"],
    displayName: "Task Graph index and projection",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/index-and-projection.ts")
  },
  {
    checkId: "test:task-graph:task-lifecycle",
    toolIds: ["task-graph"],
    displayName: "Task Graph task lifecycle",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/task-lifecycle.ts")
  },
  {
    checkId: "test:task-graph:runtime-and-store",
    toolIds: ["task-graph"],
    displayName: "Task Graph runtime and store",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/runtime-and-store.ts")
  },
  {
    checkId: "test:task-graph:native-store",
    toolIds: ["task-graph"],
    displayName: "Task Graph native store",
    requiredTag: undefined,
    command: {
      command: "node",
      args: ["--test", "./tools/task-graph/tests/native-store.test.ts"]
    }
  },
  {
    checkId: "test:task-graph:cli-rendering",
    toolIds: ["task-graph"],
    displayName: "Task Graph CLI contracts and rendering",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/cli-rendering.ts")
  },
  {
    checkId: "test:task-graph:pending-stage",
    toolIds: ["task-graph"],
    displayName: "Task Graph pending stage",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/staging.test.ts")
  },
  {
    checkId: "test:task-graph:public-distribution",
    toolIds: ["task-graph"],
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["task-graph"],
    displayName: "Task Graph public distribution",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/checks/public-distribution.ts")
  },
  {
    checkId: "test:task-graph:portable-build",
    toolIds: ["task-graph"],
    displayName: "Task Graph portable build",
    requiredTag: undefined,
    command: bunTest("./tools/task-graph/tests/portable-build.test.ts")
  },
  {
    checkId: "test:test-evidence:case-runtime",
    toolIds: ["test-evidence"],
    displayName: "Test Evidence Case runtime",
    requiredTag: undefined,
    command: bunTest("./tools/test-evidence/tests/core.test.ts")
  },
  {
    checkId: "test:test-evidence:public-boundary",
    dependsOn: ["script:check:skill-updaters"],
    generationSkillNames: ["test-evidence-review"],
    toolIds: ["test-evidence"],
    displayName: "Test Evidence public API and CLI boundary",
    requiredTag: undefined,
    command: bunTest("./tools/test-evidence/tests/public-boundary.test.ts")
  },
  {
    checkId: "test:test-evidence:project-snapshot",
    toolIds: ["test-evidence", "test-evidence-project"],
    displayName: "Test Evidence project snapshot producer",
    requiredTag: undefined,
    command: bunTest("./scripts/test-evidence/snapshot.test.ts")
  },
  {
    checkId: "test:test-evidence:project-reference-check",
    toolIds: ["test-evidence", "test-evidence-project"],
    displayName: "Test Evidence project reference check",
    requiredTag: undefined,
    command: bunTest("./scripts/test-evidence/check.test.ts")
  },
  {
    checkId: "test:test-evidence:migration",
    toolIds: ["test-evidence", "test-evidence-project"],
    displayName: "Test Evidence migration",
    requiredTag: undefined,
    command: bunTest("./scripts/test-evidence/migrate.test.ts")
  },
  ...(["initializer", "runtime", "public-distribution"] as const).map(
    (name) => ({
      checkId: `test:mcpshell:${name}` as const,
      toolIds: ["mcpshell"] as const,
      displayName: `MCPShell ${name}`,
      requiredTag: undefined,
      command: bunTest(
        `./tools/mcpshell-workspace-bridge/tests/${name === "public-distribution" ? "generated" : name}.test.ts`
      ),
      ...(name === "public-distribution"
        ? {
            dependsOn: ["script:check:skill-updaters"] as const,
            generationSkillNames: ["mcpshell-workspace-tools"] as const
          }
        : {})
    })
  )
] as const satisfies readonly SemanticGateCheck[];

export function createSemanticGateCheck(
  check: SemanticGateCheck,
  configuration: GateCheckConfiguration = {}
) {
  return commandCheck({
    checkId: check.checkId,
    displayName: check.displayName,
    ...gateCheckDeclaration(
      check.checkId,
      configuration,
      externalProcessClaim,
      check.dependsOn,
      check.requiredTag ??
        projectActivationCondition(check.toolIds, configuration)
    ),
    ...gateCommandPolicy,
    executable: check.command.command,
    arguments: check.command.args
  });
}
