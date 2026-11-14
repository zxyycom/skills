import { commonGateInputPatterns } from "./impact-paths.ts";

const codeFiles = ["scripts/**", "tools/**"];
// Runtime capabilities do not absorb unrelated maintenance scripts or tests.
// Build/copy consumers declare their additional script inputs explicitly.
const domainRuntimeInputs = [
  ...commonGateInputPatterns,
  "tools/index-runtime/src/**",
  "tools/skill-updater/src/**",
  "tools/shared/tests/**/{git-fixture,distribution-fixture}.ts",
  "tools/shared/tests/fixtures/**"
];
const generatedFileFiles = [
  "scripts/lib/**/{generated-file,generated-file-header,generated-typescript-declarations,generated-declaration-cleanup,source-map,source-runtime,source-runtime-facts,source-runtime-sync,unsupported-optional-package}.ts",
  "scripts/lib/generation/*.test.ts"
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
  "scripts/**/{auto-push.ts,setup-git-hooks.js,setup-repository.js,task-graph.js,lint.ts,vibe-check.test.ts}"
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
      "scripts/**/vibe-check*.ts",
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
      "scripts/environment.js",
      "scripts/environment/**",
      "scripts/**/auto-push*.ts",
      "scripts/**/setup-*.js",
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
    [
      ...commonGateInputPatterns,
      ...generatedFileFiles,
      "scripts/lib/record-native/tests/candidate-publish-fixture.ts",
      "scripts/lib/record-native/candidate-build-recipe.ts"
    ]
  ),
  "index-runtime": toolScope(["tools/index-runtime/**"]),
  "relation-graph": toolScope(["tools/shared/src/graph/**"]),
  "relation-graph-tests": toolScope([
    "tools/shared/tests/**/{relation-*,trace-*,lazy-relation-graph}.test.ts"
  ]),
  "file-text-search": toolScope([
    "tools/shared/src/file-text-search/**",
    "skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/**",
    "!tools/shared/src/file-text-search/record-search-output.ts",
    "!skills/{decision-records,investigation-report}/scripts/runtime/tools/shared/src/file-text-search/record-search-output.ts"
  ]),
  "file-text-search-tests": toolScope([
    "tools/shared/tests/**/{file-text-search*,record-text-search*}.ts"
  ]),
  "version-control": toolScope([
    "tools/shared/src/version-control/**",
    "tools/shared/tests/**/{version-control*,git-fixture}.ts",
    "tools/shared/tests/fixtures/**"
  ]),
  "skill-package-hash": toolScope(
    [
      "scripts/lib/**/skill-package*.ts",
      "scripts/lib/skill-package/tests/native-*.test.ts"
    ],
    [
      ...commonGateInputPatterns,
      "scripts/lib/record-native/**",
      "tools/record-cli/delivery/**",
      "tools/shared/tests/git-fixture.ts",
      "tools/shared/tests/fixtures/**"
    ]
  ),
  "skill-release-publisher": toolScope([
    "scripts/**/publish-skills{,.test}.ts",
    "scripts/lib/**/publish-skills*.ts"
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
  "record-rust": toolScope(
    [
      "tools/record-cli/**",
      "tools/record-contracts/**",
      "scripts/prepare-record-native.ts",
      "scripts/publish-native-skills.ts",
      "scripts/record-native-cli.ts",
      "scripts/lib/record-native/**"
    ],
    [
      ...commonGateInputPatterns,
      "scripts/lib/skill-package/**",
      "tools/{decision-records,investigation-report,record-operations}/{src,api,tests}/**",
      "tools/skill-package/**",
      "tools/shared/**"
    ]
  ),
  "decision-collection": toolScope(
    ["docs/decisions/**"],
    commonGateInputPatterns,
    "material"
  ),
  "investigation-collection": toolScope(
    ["docs/investigations/**"],
    commonGateInputPatterns,
    "material"
  ),
  "test-evidence-project": toolScope(
    ["scripts/test-evidence/**"],
    [...commonGateInputPatterns, "scripts/lib/record-native/runtime.ts"]
  ),
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
    [...domainRuntimeInputs, "scripts/**/{build,lib}/**"]
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
