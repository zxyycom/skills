import { commonGateInputPatterns } from "./impact-paths.ts";

const codeInputs = [...commonGateInputPatterns, "scripts/**", "tools/**"];
// Runtime capabilities do not absorb unrelated maintenance scripts or tests.
// Build/copy consumers declare their additional script inputs explicitly.
const domainRuntimeInputs = [
  ...commonGateInputPatterns,
  "tools/index-runtime/src/**",
  "tools/skill-updater/src/**",
  "tools/shared/tests/{git-fixture,distribution-fixture}.ts",
  "tools/shared/tests/fixtures/**"
];
const generatedFileInputs = [
  ...commonGateInputPatterns,
  "scripts/lib/{generated-file,generated-file-header,generated-typescript-declarations,source-map,source-runtime,source-runtime-sync,unsupported-optional-package}.ts",
  "scripts/lib/generated-file.test.ts"
];
const repositoryValidationInputs = [
  ...commonGateInputPatterns,
  "scripts/validate.ts",
  "scripts/validators/project-config.ts",
  "scripts/lib/validation.ts",
  "tools/skill-validator/src/**",
  // Validation reads content only from SKILL.md, and stat/readdir identities for
  // the top-level package/resource layout. Nested runtime bytes are not read.
  "skills",
  "skills/*",
  "skills/*/{SKILL.md,references,scripts,assets}",
  "docs/{tooling.md,skills}",
  "scripts/{auto-push.ts,setup-git-hooks.js,setup-repository.js,task-graph.js,lint.ts,vibe-check.test.ts}"
];
const recordOperationInputs = ["tools/record-operations/src/**"];
const decisionRecordInputs = [
  ...recordOperationInputs,
  "tools/decision-records/src/{application-result,index,list-facets,markdown,projection,record,relation-*,scan*,types,decision-{history-{baseline,sources},index-*,location,metadata*,path,record-lookup,source-{revision,dependencies,path-safety},state-*,timestamp,trace-admission,validation}}.ts",
  "tools/decision-records/src/decision-query-context.ts",
  "tools/decision-records/src/decision-strict-preparation.ts"
];
const decisionQueryInputs = [
  ...recordOperationInputs,
  "tools/decision-records/src/decision-query*.ts",
  "tools/decision-records/src/decision-selected-sync.ts"
];
const decisionMaintenanceInputs = [
  ...recordOperationInputs,
  "tools/decision-records/src/decision-{candidate*,collection*,discard*,lifecycle*,maintenance*,rename*,relation-*,strict-preparation,transaction*}.ts",
  "tools/decision-records/src/decision-source-membership.ts"
];
const decisionStageInputs = [
  ...recordOperationInputs,
  "tools/decision-records/src/decision-stage*.ts"
];
const decisionCliInputs = [
  ...recordOperationInputs,
  "tools/decision-records/src/cli*.ts"
];
const investigationRecordInputs = [
  ...recordOperationInputs,
  "tools/investigation-report/src/{cli-io,collection-mutation-lock,diagnostics,investigation-*,markdown*,options,relation-context,relation-summary,relation-validation,report*,resource*,timestamp,types,validation*}.ts"
];
const investigationQueryInputs = [
  ...recordOperationInputs,
  "tools/investigation-report/src/{index-staleness,list-*,query*,selected-sync,trace-output}.ts"
];
const investigationMaintenanceInputs = [
  ...recordOperationInputs,
  "tools/investigation-report/src/{candidate*,discard*,local-publication,publish*,relation-review*,relation-transaction*,rename*,strict-preparation,transaction-files}.ts"
];
const investigationStageInputs = [
  ...recordOperationInputs,
  "tools/investigation-report/src/staging*.ts"
];
const investigationCliInputs = [
  ...recordOperationInputs,
  "tools/investigation-report/src/cli*.ts"
];
const decisionTestSupportInputs = [
  "tools/decision-records/tests/{support,support-record-fixture,support-git-fixture,domain-fixture}.ts",
  "tools/decision-records/tests/fixtures/**",
  "tools/decision-records/tests/queries/snapshot-fixture.ts"
];
const investigationTestSupportInputs = [
  "tools/investigation-report/tests/{fixture-support,collection-support,git-support}.ts"
];
const decisionRecordTestInputs = [
  ...decisionTestSupportInputs,
  "tools/decision-records/tests/source-frontmatter-reuse.test.ts",
  "tools/decision-records/tests/{metadata,body-field-validation,type-path-invariants,record-guards,layout-index,relation-validation,trace-event-admission,state-snapshot,source-discovery,scan-index-reuse,trace-admission-complexity}.test.ts",
  "tools/decision-records/tests/{record-guards,metadata}/**",
  "tools/decision-records/tests/checks/record-and-established-graph.ts"
];
const decisionQueryTestInputs = [
  ...decisionTestSupportInputs,
  "tools/decision-records/tests/{index-maintenance,list-facets,queries,cli-output-trace,query-snapshot,query-loaded-snapshot,relation-filter-complexity,index-schema,search-metadata-window,discovery-dependencies,acquisition-safety,sync-preflight-lock,selected-local-contract}.test.ts",
  "tools/decision-records/tests/{queries,index-maintenance,lazy-relation-graph}/**",
  "tools/decision-records/tests/search-metadata-window-fixture.ts",
  "tools/decision-records/tests/support-local-contracts.ts",
  "tools/decision-records/tests/checks/query-and-index-projection.ts",
  "tools/record-operations/tests/{query-contract,sync-selection-contract,selected-source-safety,reader-fixture}.ts"
];
const decisionMaintenanceTestInputs = [
  ...decisionTestSupportInputs,
  "tools/decision-records/tests/{activation-archive,candidate-lifecycle,candidate-scaffold,candidate-operations,evolution,lifecycle-relations,relation-maintenance,rename,transaction-recovery,unrecorded-history,filesystem-boundaries,batch-lookup,first-establishment,reallocation-member-complexity,successor-relation-overrides,local-operation-contracts,candidate-transaction-boundaries,record-shared-transactions,transaction-boundaries,transaction-creation-modes,transaction-strict-preparation}.test.ts",
  "tools/decision-records/tests/reallocation-fixture.ts",
  "tools/decision-records/tests/native-creation-mode-probe.ts",
  "tools/decision-records/tests/support-local-contracts.ts",
  "tools/decision-records/tests/{activation-archive,candidate-lifecycle,candidate-scaffold,candidate-operations,evolution,lifecycle-relations,relation-maintenance,rename,transaction-recovery,unrecorded-history,filesystem-boundaries,localize-record-operations}/**",
  "tools/decision-records/tests/checks/lifecycle-and-recovery.ts",
  "tools/shared/tests/record-stage-evidence.ts",
  "tools/record-operations/tests/{candidate-contract,domain-transaction-contract,transaction-creation-modes}.ts"
];
const decisionStageTestInputs = [
  ...decisionTestSupportInputs,
  "tools/decision-records/tests/{stage,stage-sources,stage-index-payload,local-stage-contracts}.test.ts",
  "tools/decision-records/tests/support-local-contracts.ts",
  "tools/shared/tests/record-stage-evidence.ts",
  "tools/decision-records/tests/stage/**"
];
const decisionCliTestInputs = [
  ...decisionTestSupportInputs,
  "tools/decision-records/tests/cli-{args,stage-contract,batch-selection,search-metadata-window}.test.ts",
  "tools/decision-records/tests/cli-args/**",
  "tools/decision-records/tests/{stage,queries}/support.ts",
  "tools/decision-records/tests/{search-metadata-window-fixture,reallocation-fixture}.ts",
  "tools/decision-records/tests/queries/{domain-support,snapshot-fixture}.ts",
  "tools/decision-records/tests/support-local-contracts.ts",
  "tools/decision-records/tests/search-{relations,modes,metadata}.test.ts",
  "tools/decision-records/tests/configured-decision-directory.test.ts",
  "tools/decision-records/tests/checks/cli-contract.ts"
];
const investigationRecordTestInputs = [
  ...investigationTestSupportInputs,
  "tools/investigation-report/tests/{candidate,candidate-timestamp,candidate-read-context,parsing-directory,resources,relations,history-prefix-contract,history-pathspec-batching,batch-source-discovery}.test.ts",
  "tools/investigation-report/tests/checks/collection-and-resources.ts",
  "tools/investigation-report/tests/cli-support.ts"
];
const investigationQueryTestInputs = [
  ...investigationTestSupportInputs,
  "tools/investigation-report/tests/index-fixture.ts",
  "tools/investigation-report/tests/{index-{query,search,selectors,state,reader},current-index,list-facets,acquisition-contract,identity-membership,candidate-read-failure,snapshot-check-contract,trace-output,relation-context,relation-order,relation-dedup,selected-local-contract}.test.ts",
  "tools/investigation-report/tests/relation-context-support.ts",
  "tools/investigation-report/tests/checks/index-and-query.ts",
  "tools/record-operations/tests/selected-source-safety.ts"
];
const investigationMaintenanceTestInputs = [
  ...investigationTestSupportInputs,
  "tools/investigation-report/tests/publish-support.ts",
  "tools/investigation-report/tests/native-creation-mode-probe.ts",
  "tools/investigation-report/tests/{rename-resource-fixture,phase-verification-support}.ts",
  "tools/investigation-report/tests/{transaction*,relation-review,discard*,publish,rename*,resource-phase-verification,strict-preparation,candidate-discard-transaction,local-publication,execution-entry-contract}.test.ts",
  "tools/investigation-report/tests/fixtures/rename-noop/**",
  "tools/investigation-report/tests/checks/transactional-maintenance.ts",
  "tools/record-operations/tests/{domain-transaction-contract,transaction-creation-modes}.ts"
];
const investigationStageTestInputs = [
  ...investigationTestSupportInputs,
  "tools/investigation-report/tests/{staging*,local-stage-contract,phase-facts-contract,resource-*-contract,batch-stage-selectors}.test.ts",
  "tools/investigation-report/tests/{resource-phase-test-support,index-fixture}.ts",
  "tools/shared/tests/record-stage-evidence.ts",
  "tools/investigation-report/tests/fixtures/staging-source-path/**",
  "tools/investigation-report/tests/checks/pending-stage.ts"
];
const investigationCliTestInputs = [
  ...investigationTestSupportInputs,
  "tools/investigation-report/tests/cli-*.ts",
  "tools/investigation-report/tests/checks/cli-contract.ts",
  "tools/investigation-report/tests/{discovery-dependencies,candidate-operations,result-integrity,index-relations,search-info}.test.ts",
  "tools/investigation-report/tests/{publish-support,resource-phase-test-support,index-fixture}.ts",
  "tools/record-operations/tests/{query-contract,candidate-contract,sync-selection-contract}.ts"
];

const searchOutputInputs = [
  "tools/shared/src/file-text-search/record-search-output.ts",
  "skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
];

export const markdownLintToolSubscription = ["markdown-content"] as const;

// Each entry owns one reviewed input capability. Check subscriptions are declared
// by the semantic/package catalog and native declarations, not inferred from
// Check names or path proximity.
export const gateToolInputs = {
  // The snapshot unions these configuration inputs with the exact native
  // maintainedMarkdownFiles collection, preserving its default excludes.
  "markdown-content": commonGateInputPatterns,
  "repository-material": ["**"],
  "repository-code": codeInputs,
  // TypeScript follows imports beyond the root include patterns. Type-aware
  // lint conservatively shares this closure; its native backend does not expose
  // a complete program-read trace in the installed package.
  "typescript-program": [
    ...codeInputs,
    "skills/**/*.{ts,mts}",
    "skills/**/package.json"
  ],
  "gate-tests": [
    ...commonGateInputPatterns,
    "scripts/**",
    "tools/*/tests/**/*.test.ts",
    "tools/*/tests/{run,checks/*}.ts",
    "tools/shared/tests/git-fixture.ts",
    "tools/shared/tests/fixtures/**"
  ],
  environment: [
    ...commonGateInputPatterns,
    "scripts/**",
    "tools/skill-validator/src/validation.ts",
    "tools/shared/tests/git-fixture.ts",
    "tools/shared/tests/fixtures/**"
  ],
  "generated-artifacts": [...codeInputs, "skills/**"],
  "skill-updater": [
    ...generatedFileInputs,
    "tools/skill-updater/**",
    "skills/ai-ready-docs/**"
  ],
  "index-runtime": [...commonGateInputPatterns, "tools/index-runtime/**"],
  "relation-graph": [...commonGateInputPatterns, "tools/shared/src/graph/**"],
  "relation-graph-tests": [
    ...commonGateInputPatterns,
    "tools/shared/tests/{relation-*,trace-*,lazy-relation-graph}.test.ts"
  ],
  "file-text-search": [
    ...commonGateInputPatterns,
    "tools/shared/src/file-text-search/**",
    "skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/**",
    "!tools/shared/src/file-text-search/record-search-output.ts",
    "!skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "file-text-search-tests": [
    ...commonGateInputPatterns,
    "tools/shared/tests/{file-text-search*,record-text-search.test}.ts"
  ],
  "version-control": [
    ...commonGateInputPatterns,
    "tools/shared/tests/{version-control*,git-fixture}.ts",
    "tools/shared/tests/fixtures/**"
  ],
  "skill-package-hash": [
    ...commonGateInputPatterns,
    "scripts/lib/skill-package*.ts",
    "tools/shared/tests/git-fixture.ts",
    "tools/shared/tests/fixtures/**"
  ],
  "skill-release-publisher": [
    ...commonGateInputPatterns,
    "scripts/publish-skills{,.test}.ts",
    "scripts/lib/publish-skills*.ts"
  ],
  "repository-validation": repositoryValidationInputs,
  "generated-file": generatedFileInputs,
  "change-plan": [
    ...domainRuntimeInputs,
    "tools/change-plan/**",
    "skills/change-plan/**",
    "changes/**"
  ],
  "record-search-output": [...domainRuntimeInputs, ...searchOutputInputs],
  "record-operations": [...domainRuntimeInputs, ...recordOperationInputs],
  "record-operations-tests": [
    ...commonGateInputPatterns,
    "tools/record-operations/tests/{transaction.test,transaction-contract,transaction-creation-contract,transaction-fixture,transaction-verification-contract,reader-batch.test,reader-snapshot.test,reader-worker-runtime.test,reader-fixture,source-acquisition.test,run}.ts",
    "tools/record-operations/tests/checks/*.ts"
  ],
  "record-reader-distribution": [
    ...commonGateInputPatterns,
    "skills/{decision-records,investigation-report}/scripts/**"
  ],
  "decision-record": [...domainRuntimeInputs, ...decisionRecordInputs],
  "decision-query": [...domainRuntimeInputs, ...decisionQueryInputs],
  "decision-maintenance": [
    ...domainRuntimeInputs,
    ...decisionMaintenanceInputs
  ],
  "decision-stage": [...domainRuntimeInputs, ...decisionStageInputs],
  "decision-cli": [...domainRuntimeInputs, ...decisionCliInputs],
  "decision-test-catalog": [
    ...commonGateInputPatterns,
    "tools/decision-records/tests/run.ts"
  ],
  "decision-record-tests": [
    ...commonGateInputPatterns,
    ...decisionRecordTestInputs
  ],
  "decision-query-tests": [
    ...commonGateInputPatterns,
    ...decisionQueryTestInputs
  ],
  "decision-maintenance-tests": [
    ...commonGateInputPatterns,
    ...decisionMaintenanceTestInputs
  ],
  "decision-stage-tests": [
    ...commonGateInputPatterns,
    ...decisionStageTestInputs
  ],
  "decision-cli-tests": [...commonGateInputPatterns, ...decisionCliTestInputs],
  "investigation-record-tests": [
    ...commonGateInputPatterns,
    ...investigationRecordTestInputs
  ],
  "investigation-query-tests": [
    ...commonGateInputPatterns,
    ...investigationQueryTestInputs
  ],
  "investigation-maintenance-tests": [
    ...commonGateInputPatterns,
    ...investigationMaintenanceTestInputs
  ],
  "investigation-stage-tests": [
    ...commonGateInputPatterns,
    ...investigationStageTestInputs
  ],
  "investigation-cli-tests": [
    ...commonGateInputPatterns,
    ...investigationCliTestInputs
  ],
  "decision-distribution-tests": [
    ...commonGateInputPatterns,
    ...decisionTestSupportInputs,
    "tools/decision-records/tests/{generated-artifacts,search-info,cli-node-protocol,cli-query-parity,cli-reallocation}.test.ts",
    "tools/decision-records/tests/reallocation-fixture.ts",
    "tools/decision-records/tests/queries/domain-support.ts",
    "tools/decision-records/tests/checks/public-distribution.ts"
  ],
  "decision-distribution": [
    ...domainRuntimeInputs,
    "tools/decision-records/api/**",
    "skills/decision-records/**",
    "!skills/decision-records/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "decision-collection": [...domainRuntimeInputs, "docs/decisions/**"],
  "investigation-record": [
    ...domainRuntimeInputs,
    ...investigationRecordInputs
  ],
  "investigation-query": [...domainRuntimeInputs, ...investigationQueryInputs],
  "investigation-maintenance": [
    ...domainRuntimeInputs,
    ...investigationMaintenanceInputs
  ],
  "investigation-stage": [...domainRuntimeInputs, ...investigationStageInputs],
  "investigation-cli": [...domainRuntimeInputs, ...investigationCliInputs],
  "investigation-test-catalog": [
    ...commonGateInputPatterns,
    "tools/investigation-report/tests/run.ts"
  ],
  "investigation-distribution": [
    ...domainRuntimeInputs,
    "tools/investigation-report/api/**",
    "skills/investigation-report/**",
    "!skills/investigation-report/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "investigation-collection": [
    ...domainRuntimeInputs,
    "docs/investigations/**"
  ],
  "test-evidence-project": [
    ...commonGateInputPatterns,
    "scripts/test-evidence/**"
  ],
  "test-evidence": [
    ...domainRuntimeInputs,
    "tools/test-evidence/**",
    "skills/test-evidence-review/**",
    "docs/test-evidence/**",
    "tools/shared/src/file-text-search/**",
    "!tools/shared/src/file-text-search/record-search-output.ts"
  ],
  "task-graph": [
    ...domainRuntimeInputs,
    "scripts/{build,lib}/**",
    "tools/task-graph/**",
    "skills/task-graph/**",
    "docs/task-graph/**"
  ],
  "novel-cards": [
    ...domainRuntimeInputs,
    "tools/novel-cards/**",
    "skills/novel-cards/**"
  ],
  "lightweight-judgment": [
    ...domainRuntimeInputs,
    "tools/lightweight-judgment/**",
    "skills/lightweight-judgment/**"
  ],
  "video-understanding": [
    ...commonGateInputPatterns,
    "scripts/accept-video-windows.ts",
    "scripts/video-artifact/**",
    "tools/video-understanding/**",
    "skills/video-understanding/**"
  ],
  mcpshell: [
    ...domainRuntimeInputs,
    "tools/mcpshell-workspace-bridge/**",
    "skills/mcpshell-workspace-tools/**"
  ],
  "skill-validator": [
    ...domainRuntimeInputs,
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
