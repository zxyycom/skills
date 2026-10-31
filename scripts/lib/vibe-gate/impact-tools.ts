import { commonGateInputPatterns } from "./impact-paths.ts";

const codeFiles = ["scripts/**", "tools/**"];
// Runtime capabilities do not absorb unrelated maintenance scripts or tests.
// Build/copy consumers declare their additional script inputs explicitly.
const domainRuntimeInputs = [
  ...commonGateInputPatterns,
  "tools/index-runtime/src/**",
  "tools/skill-updater/src/**",
  "tools/shared/tests/{git-fixture,distribution-fixture}.ts",
  "tools/shared/tests/fixtures/**"
];
const generatedFileFiles = [
  "scripts/lib/{generated-file,generated-file-header,generated-typescript-declarations,source-map,source-runtime,source-runtime-facts,source-runtime-sync,unsupported-optional-package}.ts",
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
  "tools/decision-records/src/{application-result,index,list-facets,markdown,projection,record,relation-*,scan*,types,decision-{history-{baseline,sources},index-*,location,metadata*,path,record-lookup,source-{revision,dependencies,path-safety},state-*,timestamp,trace-admission,validation}}.ts",
  "tools/decision-records/src/decision-query-context.ts",
  "tools/decision-records/src/decision-strict-preparation.ts"
];
const decisionQueryInputs = [
  "tools/decision-records/src/decision-query*.ts",
  "tools/decision-records/src/decision-selected-sync.ts"
];
const decisionMaintenanceInputs = [
  "tools/decision-records/src/decision-{candidate*,collection*,discard*,lifecycle*,maintenance*,rename*,relation-*,strict-preparation,transaction*}.ts",
  "tools/decision-records/src/decision-source-membership.ts"
];
const decisionStageInputs = ["tools/decision-records/src/decision-stage*.ts"];
const decisionCliInputs = ["tools/decision-records/src/cli*.ts"];
const investigationRecordInputs = [
  "tools/investigation-report/src/{cli-io,collection-mutation-lock,diagnostics,investigation-*,markdown*,options,relation-context,relation-summary,relation-validation,report*,resource*,timestamp,types,validation*}.ts"
];
const investigationQueryInputs = [
  "tools/investigation-report/src/{index-staleness,list-*,query*,selected-sync,trace-output}.ts"
];
const investigationMaintenanceInputs = [
  "tools/investigation-report/src/{candidate*,discard*,local-publication,publish*,relation-review*,relation-transaction*,rename*,strict-preparation,transaction-files}.ts"
];
const investigationStageInputs = ["tools/investigation-report/src/staging*.ts"];
const investigationCliInputs = ["tools/investigation-report/src/cli*.ts"];
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
  "tools/decision-records/tests/{index-maintenance,list-facets,queries,cli-output-trace,query-snapshot,query-loaded-snapshot,canonical-sync-cost,relation-filter-complexity,index-schema,search-metadata-window,discovery-dependencies,acquisition-safety,sync-preflight-lock,selected-local-contract}.test.ts",
  "tools/decision-records/tests/{queries,index-maintenance,lazy-relation-graph}/**",
  "tools/decision-records/tests/search-metadata-window-fixture.ts",
  "tools/decision-records/tests/support-local-contracts.ts",
  "tools/decision-records/tests/checks/query-and-index-projection.ts",
  "tools/record-operations/tests/{query-contract,sync-selection-contract,selected-source-safety,reader-fixture}.ts"
];
const decisionMaintenanceTestInputs = [
  ...decisionTestSupportInputs,
  "tools/decision-records/tests/{activation-archive,candidate-lifecycle,candidate-scaffold,candidate-operations,evolution,lifecycle-relations,relation-maintenance,rename,transaction-recovery,unrecorded-history,filesystem-boundaries,batch-lookup,batch-lookup-cost,first-establishment,reallocation-member-complexity,successor-relation-overrides,local-operation-contracts,candidate-transaction-boundaries,record-shared-transactions,transaction-boundaries,transaction-creation-modes,transaction-strict-preparation}.test.ts",
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
  "tools/investigation-report/tests/{candidate,candidate-timestamp,candidate-read-context,candidate-resource-root,parsing-directory,resources,relations,history-prefix-contract,history-pathspec-batching,batch-source-discovery}.test.ts",
  "tools/investigation-report/tests/checks/collection-and-resources.ts",
  "tools/investigation-report/tests/cli-support.ts"
];
const investigationQueryTestInputs = [
  ...investigationTestSupportInputs,
  "tools/investigation-report/tests/index-fixture.ts",
  "tools/investigation-report/tests/{index-{query,search,selectors,state,reader},selector-batch-cost,current-index,list-facets,acquisition-contract,identity-membership,candidate-read-failure,snapshot-check-contract,trace-output,relation-context,relation-order,relation-dedup,selected-local-contract}.test.ts",
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

export type GateToolScope = Readonly<{
  kind: "code" | "declarations" | "material";
  files: readonly string[];
  additionalInputs: readonly string[];
}>;

function toolScope(
  files: readonly string[],
  additionalInputs: readonly string[] = commonGateInputPatterns,
  kind: GateToolScope["kind"] = "code"
): GateToolScope {
  if (kind === "code" && !files.some(isGateCodePattern))
    throw new Error(
      "Code scopes must declare maintained scripts/tools patterns"
    );
  return { kind, files, additionalInputs };
}

const recordRuntimeInputs = [...domainRuntimeInputs, ...recordOperationInputs];

// files is the shared domain boundary. Additional inputs keep command/receipt
// dependencies complete without turning them into locally selected metric files.
export const gateToolScopes = {
  // The snapshot additionally supplies the native maintainedMarkdownFiles set.
  "markdown-content": toolScope([], commonGateInputPatterns, "material"),
  "repository-material": toolScope(
    ["docs/**", "skills/**", "changes/**"],
    ["**"],
    "material"
  ),
  "repository-code": toolScope(codeFiles),
  "typescript-program": toolScope([
    ...codeFiles,
    "skills/**/*.{ts,mts}",
    "skills/**/package.json"
  ]),
  "gate-tests": toolScope(
    [
      "scripts/vibe-check*.ts",
      "scripts/lib/vibe-gate.ts",
      "scripts/lib/vibe-gate/**"
    ],
    [
      ...commonGateInputPatterns,
      "scripts/**",
      "tools/*/tests/**/*.test.ts",
      "tools/*/tests/{run,checks/*}.ts",
      "tools/shared/tests/git-fixture.ts",
      "tools/shared/tests/fixtures/**"
    ]
  ),
  environment: toolScope(
    [
      "scripts/environment*.{js,ts}",
      "scripts/auto-push*.ts",
      "scripts/setup-*.js",
      "scripts/validators/project-config*.ts"
    ],
    [
      ...commonGateInputPatterns,
      "scripts/**",
      "tools/skill-validator/src/validation.ts",
      "tools/shared/tests/git-fixture.ts",
      "tools/shared/tests/fixtures/**"
    ]
  ),
  "generated-artifacts": toolScope([...codeFiles, "skills/**"]),
  "skill-updater": toolScope(
    ["tools/skill-updater/**", "skills/ai-ready-docs/**"],
    [...commonGateInputPatterns, ...generatedFileFiles]
  ),
  "index-runtime": toolScope(["tools/index-runtime/**"]),
  "relation-graph": toolScope(["tools/shared/src/graph/**"]),
  "relation-graph-tests": toolScope([
    "tools/shared/tests/{relation-*,trace-*,lazy-relation-graph}.test.ts"
  ]),
  "file-text-search": toolScope([
    "tools/shared/src/file-text-search/**",
    "skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/**",
    "!tools/shared/src/file-text-search/record-search-output.ts",
    "!skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ]),
  "file-text-search-tests": toolScope([
    "tools/shared/tests/{file-text-search*,record-text-search*}.ts"
  ]),
  "version-control": toolScope([
    "tools/shared/src/version-control/**",
    "tools/shared/tests/{version-control*,git-fixture}.ts",
    "tools/shared/tests/fixtures/**"
  ]),
  "skill-package-hash": toolScope(
    ["scripts/lib/skill-package*.ts"],
    [
      ...commonGateInputPatterns,
      "tools/shared/tests/git-fixture.ts",
      "tools/shared/tests/fixtures/**"
    ]
  ),
  "skill-release-publisher": toolScope([
    "scripts/publish-skills{,.test}.ts",
    "scripts/lib/publish-skills*.ts"
  ]),
  "repository-validation": toolScope(
    [
      "scripts/validate.ts",
      "scripts/validators/project-config.ts",
      "scripts/lib/validation.ts",
      "skills/*/SKILL.md"
    ],
    repositoryValidationInputs
  ),
  "generated-file": toolScope(generatedFileFiles),
  "change-plan": toolScope(
    ["tools/change-plan/**", "skills/change-plan/**", "changes/**"],
    domainRuntimeInputs
  ),
  "record-search-output": toolScope(searchOutputInputs, domainRuntimeInputs),
  "record-operations": toolScope(recordOperationInputs, domainRuntimeInputs),
  "record-operations-tests": toolScope([
    "tools/record-operations/tests/{transaction.test,transaction-contract,transaction-creation-contract,transaction-fixture,transaction-verification-contract,reader-batch.test,reader-snapshot.test,reader-worker-runtime.test,reader-fixture,source-acquisition.test,run}.ts",
    "tools/record-operations/tests/checks/*.ts"
  ]),
  "record-reader-distribution": toolScope(
    ["skills/{decision-records,investigation-report}/scripts/**"],
    commonGateInputPatterns,
    "material"
  ),
  "decision-record": toolScope(decisionRecordInputs, recordRuntimeInputs),
  "decision-query": toolScope(decisionQueryInputs, recordRuntimeInputs),
  "decision-maintenance": toolScope(
    decisionMaintenanceInputs,
    recordRuntimeInputs
  ),
  "decision-stage": toolScope(decisionStageInputs, recordRuntimeInputs),
  "decision-cli": toolScope(decisionCliInputs, recordRuntimeInputs),
  "decision-test-catalog": toolScope(["tools/decision-records/tests/run.ts"]),
  "decision-record-tests": toolScope(decisionRecordTestInputs),
  "decision-query-tests": toolScope(decisionQueryTestInputs),
  "decision-maintenance-tests": toolScope(decisionMaintenanceTestInputs),
  "decision-stage-tests": toolScope(decisionStageTestInputs),
  "decision-cli-tests": toolScope(decisionCliTestInputs),
  "investigation-record-tests": toolScope(investigationRecordTestInputs),
  "investigation-query-tests": toolScope(investigationQueryTestInputs),
  "investigation-maintenance-tests": toolScope(
    investigationMaintenanceTestInputs
  ),
  "investigation-stage-tests": toolScope(investigationStageTestInputs),
  "investigation-cli-tests": toolScope(investigationCliTestInputs),
  "decision-distribution-tests": toolScope([
    ...decisionTestSupportInputs,
    "tools/decision-records/tests/{generated-artifacts,search-info,cli-node-protocol,cli-query-parity,cli-reallocation}.test.ts",
    "tools/decision-records/tests/reallocation-fixture.ts",
    "tools/decision-records/tests/queries/domain-support.ts",
    "tools/decision-records/tests/checks/public-distribution.ts"
  ]),
  "decision-distribution": toolScope(
    [
      "tools/decision-records/api/**",
      "skills/decision-records/**",
      "!skills/decision-records/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
    ],
    domainRuntimeInputs,
    "declarations"
  ),
  "decision-collection": toolScope(
    ["docs/decisions/**"],
    domainRuntimeInputs,
    "material"
  ),
  "investigation-record": toolScope(
    investigationRecordInputs,
    recordRuntimeInputs
  ),
  "investigation-query": toolScope(
    investigationQueryInputs,
    recordRuntimeInputs
  ),
  "investigation-maintenance": toolScope(
    investigationMaintenanceInputs,
    recordRuntimeInputs
  ),
  "investigation-stage": toolScope(
    investigationStageInputs,
    recordRuntimeInputs
  ),
  "investigation-cli": toolScope(investigationCliInputs, recordRuntimeInputs),
  "investigation-test-catalog": toolScope([
    "tools/investigation-report/tests/run.ts"
  ]),
  "investigation-distribution": toolScope(
    [
      "tools/investigation-report/api/**",
      "skills/investigation-report/**",
      "!skills/investigation-report/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
    ],
    domainRuntimeInputs,
    "declarations"
  ),
  "investigation-collection": toolScope(
    ["docs/investigations/**"],
    domainRuntimeInputs,
    "material"
  ),
  "test-evidence-project": toolScope(["scripts/test-evidence/**"]),
  "test-evidence": toolScope(
    [
      "tools/test-evidence/**",
      "skills/test-evidence-review/**",
      "docs/test-evidence/**"
    ],
    [
      ...domainRuntimeInputs,
      "tools/shared/src/file-text-search/**",
      "!tools/shared/src/file-text-search/record-search-output.ts"
    ]
  ),
  "task-graph": toolScope(
    ["tools/task-graph/**", "skills/task-graph/**", "docs/task-graph/**"],
    [...domainRuntimeInputs, "scripts/{build,lib}/**"]
  ),
  "novel-cards": toolScope(
    ["tools/novel-cards/**", "skills/novel-cards/**"],
    domainRuntimeInputs
  ),
  "lightweight-judgment": toolScope(
    ["tools/lightweight-judgment/**", "skills/lightweight-judgment/**"],
    domainRuntimeInputs
  ),
  "video-understanding": toolScope([
    "scripts/accept-video-windows.ts",
    "scripts/video-artifact/**",
    "tools/video-understanding/**",
    "skills/video-understanding/**"
  ]),
  mcpshell: toolScope(
    [
      "tools/mcpshell-workspace-bridge/**",
      "skills/mcpshell-workspace-tools/**"
    ],
    domainRuntimeInputs
  ),
  "skill-validator": toolScope(
    [
      "tools/skill-validator/**",
      "skills/skill-maintainer/**",
      "skills/**/SKILL.md"
    ],
    domainRuntimeInputs
  )
} as const satisfies Readonly<Record<string, GateToolScope>>;

export type GateToolId = keyof typeof gateToolScopes;
export type GateToolSubscription = readonly [GateToolId, ...GateToolId[]];

// This is a derived compatibility view for complete-input fingerprints, not a
// second scope table. All path ownership stays in gateToolScopes.
export const gateToolInputs = Object.fromEntries<readonly string[]>(
  Object.entries(gateToolScopes).map(([id, scope]) => [
    id,
    [...scope.additionalInputs, ...scope.files]
  ])
) as Readonly<Record<GateToolId, readonly string[]>>;

export const gateCodeToolIds: GateToolSubscription = [
  "repository-code",
  ...Object.entries(gateToolScopes)
    .filter(([id, { kind }]) => id !== "repository-code" && kind !== "material")
    .map(([id]) => id as GateToolId)
];

export const gateMetricToolIds: GateToolSubscription = [
  "repository-code",
  ...Object.entries(gateToolScopes)
    .filter(([id, { kind }]) => id !== "repository-code" && kind === "code")
    .map(([id]) => id as GateToolId)
];

export function isGateCodePattern(pattern: string): boolean {
  return pattern.startsWith("scripts/") || pattern.startsWith("tools/");
}

export function activationFlagForTool(toolId: string): string {
  return `gate-tool:${toolId}`;
}
