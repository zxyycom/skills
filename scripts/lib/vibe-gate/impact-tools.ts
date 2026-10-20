import { commonGateInputPatterns } from "./impact-paths.ts";

const codeInputs = [...commonGateInputPatterns, "tools/**"];
const decisionRecordInputs = [
  "tools/decision-records/src/{application-result,index,list-facets,markdown,projection,record,relation-*,scan*,types,decision-{history-baseline,index-*,location,metadata*,path,record-lookup,source-revision,state-*,timestamp,trace-admission}}.ts",
  "tools/decision-records/src/decision-query-context.ts",
  "tools/decision-records/tests/{support,support-record-fixture,support-git-fixture,domain-fixture,run}.ts",
  "tools/decision-records/tests/fixtures/**",
  "tools/decision-records/tests/{metadata,body-field-validation,type-path-invariants,record-guards,layout-index,relation-validation,trace-event-admission,state-snapshot,trace-admission-complexity}.test.ts",
  "tools/decision-records/tests/{record-guards,metadata}/**",
  "tools/decision-records/tests/queries/snapshot-fixture.ts",
  "tools/decision-records/tests/checks/record-and-established-graph.ts"
];
const decisionQueryInputs = [
  "tools/decision-records/src/decision-query*.ts",
  "tools/decision-records/tests/{index-maintenance,list-facets,queries,cli-output-trace,query-snapshot,relation-filter-complexity,index-schema,search-info}.test.ts",
  "tools/decision-records/tests/{queries,index-maintenance}/**",
  "tools/decision-records/tests/checks/query-and-index-projection.ts"
];
const decisionMaintenanceInputs = [
  "tools/decision-records/src/decision-{candidate*,collection*,discard*,lifecycle*,rename*,relation-*,transaction*}.ts",
  "tools/decision-records/tests/{activation-archive,candidate-lifecycle,candidate-scaffold,evolution,lifecycle-relations,relation-maintenance,rename,transaction-recovery,unrecorded-history,filesystem-boundaries,batch-lookup,first-establishment,reallocation-member-complexity,successor-relation-overrides}.test.ts",
  "tools/decision-records/tests/reallocation-fixture.ts",
  "tools/decision-records/tests/{activation-archive,candidate-lifecycle,candidate-scaffold,evolution,lifecycle-relations,relation-maintenance,rename,transaction-recovery,unrecorded-history,filesystem-boundaries}/**",
  "tools/decision-records/tests/checks/lifecycle-and-recovery.ts"
];
const decisionStageInputs = [
  "tools/decision-records/src/decision-stage*.ts",
  "tools/decision-records/tests/{stage,stage-sources}.test.ts",
  "tools/decision-records/tests/stage/**"
];
const decisionCliInputs = [
  "tools/decision-records/src/cli*.ts",
  "tools/decision-records/tests/cli-*.ts",
  "tools/decision-records/tests/cli-args/**",
  "tools/decision-records/tests/configured-decision-directory.test.ts",
  "tools/decision-records/tests/checks/public-distribution.ts"
];
const investigationRecordInputs = [
  "tools/investigation-report/src/{cli-io,collection-mutation-lock,diagnostics,investigation-*,markdown*,options,relation-summary,relation-validation,report*,resource*,timestamp,types,validation*}.ts",
  "tools/investigation-report/tests/{fixture-support,collection-support,git-support,run}.ts",
  "tools/investigation-report/tests/{candidate,candidate-timestamp,parsing-directory,resources,relations,history-prefix-contract,batch-source-discovery}.test.ts",
  "tools/investigation-report/tests/checks/collection-and-resources.ts"
];
const investigationQueryInputs = [
  "tools/investigation-report/src/{index-staleness,list-*,query*,trace-output}.ts",
  "tools/investigation-report/tests/index-fixture.ts",
  "tools/investigation-report/tests/{index-*,list-facets,acquisition-contract,identity-membership,candidate-read-failure,snapshot-check-contract,trace-output,search-info}.test.ts",
  "tools/investigation-report/tests/checks/index-and-query.ts"
];
const investigationMaintenanceInputs = [
  "tools/investigation-report/src/{candidate*,discard*,publish*,relation-review*,relation-transaction*,rename*}.ts",
  "tools/investigation-report/tests/publish-support.ts",
  "tools/investigation-report/tests/{transaction*,relation-review,discard,publish,rename*}.test.ts",
  "tools/investigation-report/tests/checks/transactional-maintenance.ts"
];
const investigationStageInputs = [
  "tools/investigation-report/src/staging*.ts",
  "tools/investigation-report/tests/{staging*,local-stage-contract,phase-facts-contract,resource-*-contract,batch-stage-selectors}.test.ts",
  "tools/investigation-report/tests/resource-phase-test-support.ts",
  "tools/investigation-report/tests/fixtures/staging-source-path/**",
  "tools/investigation-report/tests/checks/pending-stage.ts"
];
const investigationCliInputs = [
  "tools/investigation-report/src/cli*.ts",
  "tools/investigation-report/tests/cli-*.ts",
  "tools/investigation-report/tests/checks/cli-contract.ts"
];
const searchOutputInputs = [
  "tools/shared/src/file-text-search/record-search-output.ts",
  "skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
];

// Each entry owns one reviewed input capability. Check subscriptions are declared
// by the semantic/package catalog, not inferred from Check names or path proximity.
export const gateToolInputs = {
  "repository-material": ["**"],
  "repository-code": codeInputs,
  "gate-tests": [...commonGateInputPatterns, "tools/*/tests/**"],
  environment: commonGateInputPatterns,
  "generated-artifacts": [...codeInputs, "skills/**"],
  "skill-updater": [...commonGateInputPatterns, "skills/ai-ready-docs/**"],
  "index-runtime": commonGateInputPatterns,
  "relation-graph": [...commonGateInputPatterns, "tools/shared/src/graph/**"],
  "file-text-search": [
    ...commonGateInputPatterns,
    "tools/shared/src/file-text-search/**",
    "skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/**",
    "!tools/shared/src/file-text-search/record-search-output.ts",
    "!skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "version-control": commonGateInputPatterns,
  "skill-package-hash": commonGateInputPatterns,
  "skill-release-publisher": commonGateInputPatterns,
  "change-plan": [
    ...commonGateInputPatterns,
    "tools/change-plan/**",
    "skills/change-plan/**",
    "changes/**"
  ],
  "record-search-output": [...commonGateInputPatterns, ...searchOutputInputs],
  "decision-record": [...commonGateInputPatterns, ...decisionRecordInputs],
  "decision-query": [...commonGateInputPatterns, ...decisionQueryInputs],
  "decision-maintenance": [
    ...commonGateInputPatterns,
    ...decisionMaintenanceInputs
  ],
  "decision-stage": [...commonGateInputPatterns, ...decisionStageInputs],
  "decision-cli": [...commonGateInputPatterns, ...decisionCliInputs],
  "decision-distribution": [
    ...commonGateInputPatterns,
    "tools/decision-records/api/**",
    "tools/decision-records/tests/generated-artifacts.test.ts",
    "skills/decision-records/**",
    "!skills/decision-records/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "decision-collection": [...commonGateInputPatterns, "docs/decisions/**"],
  "investigation-record": [
    ...commonGateInputPatterns,
    ...investigationRecordInputs
  ],
  "investigation-query": [
    ...commonGateInputPatterns,
    ...investigationQueryInputs
  ],
  "investigation-maintenance": [
    ...commonGateInputPatterns,
    ...investigationMaintenanceInputs
  ],
  "investigation-stage": [
    ...commonGateInputPatterns,
    ...investigationStageInputs
  ],
  "investigation-cli": [...commonGateInputPatterns, ...investigationCliInputs],
  "investigation-distribution": [
    ...commonGateInputPatterns,
    "tools/investigation-report/api/**",
    "skills/investigation-report/**",
    "!skills/investigation-report/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "investigation-collection": [
    ...commonGateInputPatterns,
    "docs/investigations/**"
  ],
  "test-evidence": [
    ...commonGateInputPatterns,
    "tools/test-evidence/**",
    "skills/test-evidence-review/**",
    "docs/test-evidence/**",
    "tools/shared/src/file-text-search/**",
    "!tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "task-graph": [
    ...commonGateInputPatterns,
    "tools/task-graph/**",
    "skills/task-graph/**",
    "docs/task-graph/**"
  ],
  "novel-cards": [
    ...commonGateInputPatterns,
    "tools/novel-cards/**",
    "skills/novel-cards/**"
  ],
  "lightweight-judgment": [
    ...commonGateInputPatterns,
    "tools/lightweight-judgment/**",
    "skills/lightweight-judgment/**"
  ],
  mcpshell: [
    ...commonGateInputPatterns,
    "tools/mcpshell-workspace-bridge/**",
    "skills/mcpshell-workspace-tools/**"
  ],
  "skill-validator": [
    ...commonGateInputPatterns,
    "tools/skill-validator/**",
    "skills/skill-maintainer/**",
    "skills/**/SKILL.md"
  ]
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type GateToolId = keyof typeof gateToolInputs;
export type GateToolSubscription = readonly [GateToolId, ...GateToolId[]];

export function activationFlagForTool(toolId: string): string {
  return `gate-tool:${toolId}`;
}
