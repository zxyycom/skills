import { commandCheck } from "@zxyycom/vibe-check";
import {
  externalProcessClaim,
  gateCheckDeclaration,
  projectActivationCondition,
  type GateCheckConfiguration,
  type GateTag
} from "../contracts.ts";
import { gateCommandPolicy, type GateCommand } from "../command-runner.ts";
import type { GateToolSubscription } from "../impact/impact-tools.ts";
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
    checkId: "test:record-rust:delivery",
    toolIds: ["record-rust"],
    requiredTag: undefined,
    displayName: "Record Rust candidate delivery",
    command: {
      command: "node",
      args: ["--test", "./tools/record-cli/delivery/delivery.test.ts"]
    }
  },
  {
    checkId: "test:record-rust:contracts",
    toolIds: ["record-rust"],
    requiredTag: undefined,
    displayName: "Record native published schema contracts",
    command: {
      command: "node",
      args: ["--test", "./tools/record-contracts/tests/schema.test.ts"]
    }
  },
  {
    checkId: "test:record-rust:runtime",
    toolIds: ["record-rust"],
    requiredTag: undefined,
    displayName: "Record Rust repository runtime",
    command: {
      command: "node",
      args: [
        "--test",
        "./scripts/lib/record-native/tests/candidate-publish.test.ts",
        "./scripts/lib/record-native/tests/candidate-publish-github.test.ts",
        "./scripts/lib/record-native/tests/candidate-publish-recovery.test.ts",
        "./scripts/lib/record-native/tests/candidate-generate.test.ts",
        "./scripts/lib/record-native/tests/candidate-package.test.ts",
        "./scripts/lib/record-native/tests/ci-bootstrap-first-target.test.ts",
        "./scripts/lib/record-native/tests/ci-bootstrap-lock.test.ts",
        "./scripts/lib/record-native/tests/ci-bootstrap-source.test.ts",
        "./scripts/lib/record-native/tests/ci-frozen.test.ts",
        "./scripts/lib/record-native/tests/ci-release-evidence.test.ts",
        "./scripts/lib/record-native/tests/ci-release-reuse.test.ts",
        "./scripts/lib/record-native/tests/ci-release-workflow.test.ts",
        "./scripts/lib/record-native/tests/ci-release-online-target.test.ts",
        "./scripts/lib/record-native/tests/runtime.test.ts"
      ]
    }
  },
  {
    checkId: "test:record-rust:format",
    toolIds: ["record-rust"],
    requiredTag: undefined,
    displayName: "Record Rust formatting",
    command: {
      command: "cargo",
      args: [
        "+1.98.1",
        "fmt",
        "--manifest-path",
        "tools/record-cli/Cargo.toml",
        "--",
        "--check"
      ]
    }
  },
  {
    checkId: "test:record-rust:clippy",
    toolIds: ["record-rust"],
    requiredTag: undefined,
    displayName: "Record Rust clippy",
    command: {
      command: "cargo",
      args: [
        "+1.98.1",
        "clippy",
        "--manifest-path",
        "tools/record-cli/Cargo.toml",
        "--locked",
        "--all-targets",
        "--",
        "-D",
        "warnings"
      ]
    }
  },
  {
    checkId: "test:record-rust:cargo",
    toolIds: ["record-rust"],
    requiredTag: undefined,
    displayName: "Record Rust native tests",
    command: {
      command: "cargo",
      args: [
        "+1.98.1",
        "test",
        "--manifest-path",
        "tools/record-cli/Cargo.toml",
        "--locked",
        "--all-targets",
        "--",
        "--include-ignored"
      ]
    }
  },
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
      args: ["--test", "./tools/task-graph/tests/store/native-store.test.ts"]
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
    command: bunTest("./tools/task-graph/tests/staging/staging.test.ts")
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
    command: bunTest(
      "./tools/task-graph/tests/distribution/portable-build.test.ts"
    )
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
    command: bunTest("./scripts/test-evidence/snapshot/snapshot.test.ts")
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
    command: bunTest("./scripts/test-evidence/migration/tests/migrate.test.ts")
  },
  ...(
    [
      {
        name: "initializer",
        testFile:
          "./tools/mcpshell-workspace-bridge/tests/initializer/initializer.test.ts"
      },
      {
        name: "runtime",
        testFile:
          "./tools/mcpshell-workspace-bridge/tests/runtime/runtime.test.ts"
      },
      {
        name: "public-distribution",
        testFile:
          "./tools/mcpshell-workspace-bridge/tests/distribution/generated.test.ts"
      }
    ] as const
  ).map(({ name, testFile }) => ({
    checkId: `test:mcpshell:${name}` as const,
    toolIds: ["mcpshell"] as const,
    displayName: `MCPShell ${name}`,
    requiredTag: undefined,
    command: bunTest(testFile),
    ...(name === "public-distribution"
      ? {
          dependsOn: ["script:check:skill-updaters"] as const,
          generationSkillNames: ["mcpshell-workspace-tools"] as const
        }
      : {})
  }))
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
