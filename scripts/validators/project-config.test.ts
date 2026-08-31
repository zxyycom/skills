import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  authoritativeGatePackageScripts,
  maintenanceCliPackageScripts,
  requiredPackageScripts,
  validatePackageScripts,
  validateOxcConfigurationFiles,
  validateRepositoryPermissionRules
} from "./project-config.ts";
import { formatPackageScripts, lintPackageScripts } from "../lib/oxc-config.ts";
import { runLint } from "../lint.ts";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

type OxlintPolicyMutation = {
  expectedFailure: string;
  mutate: (configuration: Record<string, unknown>) => void;
};

const oxlintPolicyMutations: readonly OxlintPolicyMutation[] = [
  {
    expectedFailure:
      "ignorePatterns is not an allowed repository Oxlint setting",
    mutate: (configuration) => {
      configuration.ignorePatterns = ["tools/**"];
    }
  },
  {
    expectedFailure: "extends is not an allowed repository Oxlint setting",
    mutate: (configuration) => {
      configuration.extends = ["./base-oxlint.json"];
    }
  },
  {
    expectedFailure:
      'options must set "reportUnusedDisableDirectives" to "error" and "typeAware" to true',
    mutate: (configuration) => {
      configuration.options = {
        reportUnusedDisableDirectives: "error",
        typeAware: false
      };
    }
  },
  {
    expectedFailure:
      'options must set "reportUnusedDisableDirectives" to "error" and "typeAware" to true',
    mutate: (configuration) => {
      configuration.options = {
        reportUnusedDisableDirectives: "off",
        typeAware: true
      };
    }
  },
  {
    expectedFailure: 'categories must equal { "correctness": "error" }',
    mutate: (configuration) => {
      configuration.categories = { correctness: "off" };
    }
  },
  {
    expectedFailure: 'plugins must equal ["typescript", "unicorn", "oxc"]',
    mutate: (configuration) => {
      configuration.plugins = ["unicorn"];
    }
  },
  {
    expectedFailure:
      'rules must preserve the approved "typescript/no-floating-promises" configuration',
    mutate: (configuration) => {
      configuration.rules = { "typescript/no-floating-promises": "off" };
    }
  }
];

function cloneJsonRecord(
  value: Record<string, unknown>
): Record<string, unknown> {
  return structuredClone(value);
}

function oxlintPolicyError(configurationPath: string, failure: string): string {
  return (
    `${configurationPath} violates the repository Oxlint policy:\n` +
    `- ${failure}; update the policy owner before changing lint behavior\n` +
    "Fix the affected code; only for a direct contract conflict, use the narrowest justified oxlint-disable-next-line at that line."
  );
}

function requiredPackageJson(): string {
  const scripts = Object.fromEntries(
    requiredPackageScripts.map((scriptName) => [
      scriptName,
      `bun run ${scriptName}`
    ])
  );
  Object.assign(
    scripts,
    maintenanceCliPackageScripts,
    authoritativeGatePackageScripts,
    formatPackageScripts,
    lintPackageScripts
  );
  return `${JSON.stringify({ scripts }, undefined, 2)}\n`;
}

test("project package script validation preserves maintenance CLI delegations and the authoritative Vibe gate", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills package scripts ")
  );
  try {
    const packageJsonPath = path.join(tempRoot, "package.json");
    const validPackageJson = requiredPackageJson();
    await fs.writeFile(packageJsonPath, validPackageJson, "utf8");

    const currentErrors: string[] = [];
    await validatePackageScripts(
      (message) => currentErrors.push(message),
      tempRoot
    );
    assert.deepEqual(currentErrors, []);

    const expectedDecisionCommand =
      maintenanceCliPackageScripts["decision-records"];
    const invalidPackageJson = validPackageJson.replace(
      JSON.stringify(expectedDecisionCommand),
      JSON.stringify("node scripts/wrong-decision-entry.mjs")
    );
    assert.notEqual(invalidPackageJson, validPackageJson);
    await fs.writeFile(packageJsonPath, invalidPackageJson, "utf8");

    const invalidErrors: string[] = [];
    await validatePackageScripts(
      (message) => invalidErrors.push(message),
      tempRoot
    );
    assert.deepEqual(invalidErrors, [
      `package.json script decision-records must delegate to ${expectedDecisionCommand}`
    ]);

    const invalidGatePackageJson = validPackageJson
      .replace(
        JSON.stringify(authoritativeGatePackageScripts.check),
        JSON.stringify("bun scripts/check.ts")
      )
      .replace(
        '"scripts": {',
        '"scripts": {\n    "vibe-check": "bun scripts/vibe-check.ts",'
      );
    await fs.writeFile(packageJsonPath, invalidGatePackageJson, "utf8");

    const invalidGateErrors: string[] = [];
    await validatePackageScripts(
      (message) => invalidGateErrors.push(message),
      tempRoot
    );
    assert.deepEqual(invalidGateErrors, [
      `package.json script check must be ${authoritativeGatePackageScripts.check}; restore the authoritative Vibe Check entry`,
      "package.json must not define the retired vibe-check candidate; use check"
    ]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("format scripts cover repository automation and distributable tool sources", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills format package scripts ")
  );
  try {
    const packageJsonPath = path.join(tempRoot, "package.json");
    const invalidPackageJson = requiredPackageJson()
      .replace(
        JSON.stringify(formatPackageScripts.format),
        JSON.stringify("oxfmt --write scripts")
      )
      .replace(
        JSON.stringify(formatPackageScripts["format:check"]),
        JSON.stringify("oxfmt --check scripts")
      );
    await fs.writeFile(packageJsonPath, invalidPackageJson, "utf8");

    const errors: string[] = [];
    await validatePackageScripts((message) => errors.push(message), tempRoot);
    assert.deepEqual(errors, [
      `package.json script format must be ${formatPackageScripts.format}; restore the repository Oxfmt command`,
      `package.json script format:check must be ${formatPackageScripts["format:check"]}; restore the repository Oxfmt command`
    ]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("lint entry preserves Oxlint configuration preflight", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills lint preflight ")
  );
  try {
    const packageJsonPath = path.join(tempRoot, "package.json");
    const invalidPackageJson = requiredPackageJson()
      .replace(
        JSON.stringify(lintPackageScripts.lint),
        JSON.stringify("oxlint --type-aware --deny-warnings scripts tools")
      )
      .replace(
        JSON.stringify(lintPackageScripts["lint:fix"]),
        JSON.stringify(
          "oxlint --type-aware --deny-warnings --fix scripts tools"
        )
      );
    await fs.writeFile(packageJsonPath, invalidPackageJson, "utf8");

    const packageErrors: string[] = [];
    await validatePackageScripts(
      (message) => packageErrors.push(message),
      tempRoot
    );
    assert.deepEqual(packageErrors, [
      `package.json script lint must be ${lintPackageScripts.lint}; restore the repository Oxlint preflight command`,
      `package.json script lint:fix must be ${lintPackageScripts["lint:fix"]}; restore the repository Oxlint preflight command`
    ]);

    const oxlintConfigurationPath = path.join(tempRoot, ".oxlintrc.json");
    const oxlintConfiguration = JSON.parse(
      await fs.readFile(path.join(workspaceRoot, ".oxlintrc.json"), "utf8")
    ) as Record<string, unknown>;
    oxlintConfiguration.overrides = [
      {
        files: ["scripts/example.ts"],
        rules: { "no-unused-vars": "off" }
      }
    ];
    await fs.writeFile(
      oxlintConfigurationPath,
      `${JSON.stringify(oxlintConfiguration, undefined, 2)}\n`,
      "utf8"
    );

    const lintErrors: string[] = [];
    let oxlintRan = false;
    const exitCode = await runLint({
      report: (message) => lintErrors.push(message),
      runOxlint: async () => {
        oxlintRan = true;
        return 0;
      },
      workspaceRoot: tempRoot
    });
    assert.equal(exitCode, 1);
    assert.equal(oxlintRan, false);
    assert.deepEqual(lintErrors, [
      oxlintPolicyError(
        oxlintConfigurationPath,
        "overrides is not an allowed repository Oxlint setting"
      )
    ]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("project package script validation maps invalid JSON boundaries", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills invalid package json ")
  );
  try {
    const packageJsonPath = path.join(tempRoot, "package.json");
    await fs.writeFile(packageJsonPath, "{\n", "utf8");

    const malformedErrors: string[] = [];
    await validatePackageScripts(
      (message) => malformedErrors.push(message),
      tempRoot
    );
    assert.equal(malformedErrors.length, 1);
    assert.match(
      malformedErrors[0] ?? "",
      /^package\.json is not valid JSON:/u
    );

    await fs.writeFile(packageJsonPath, '{"scripts":[]}\n', "utf8");
    const invalidShapeErrors: string[] = [];
    await validatePackageScripts(
      (message) => invalidShapeErrors.push(message),
      tempRoot
    );
    assert.deepEqual(invalidShapeErrors, [
      "package.json scripts must be an object"
    ]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test(
  "project configuration requires Oxc configuration files",
  { timeout: 15_000 },
  async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "skills required project files ")
    );
    try {
      const errors: string[] = [];
      await validateOxcConfigurationFiles(
        (message) => errors.push(message),
        tempRoot
      );

      assert.ok(errors.some((message) => message.includes(".oxfmtrc.json")));
      assert.ok(errors.some((message) => message.includes(".oxlintrc.json")));

      await fs.writeFile(
        path.join(tempRoot, ".oxfmtrc.json"),
        '{"printWidth":true}\n',
        "utf8"
      );
      await fs.writeFile(path.join(tempRoot, ".oxlintrc.json"), "[]\n", "utf8");
      const invalidErrors: string[] = [];
      await validateOxcConfigurationFiles(
        (message) => invalidErrors.push(message),
        tempRoot
      );
      assert.ok(
        invalidErrors.some(
          (message) =>
            message.includes(".oxfmtrc.json") && message.includes("/printWidth")
        )
      );
      assert.ok(
        invalidErrors.some((message) => message.includes(".oxlintrc.json"))
      );

      await Promise.all([
        fs.copyFile(
          path.join(workspaceRoot, ".oxfmtrc.json"),
          path.join(tempRoot, ".oxfmtrc.json")
        ),
        fs.copyFile(
          path.join(workspaceRoot, ".oxlintrc.json"),
          path.join(tempRoot, ".oxlintrc.json")
        )
      ]);
      const currentConfigurationErrors: string[] = [];
      await validateOxcConfigurationFiles(
        (message) => currentConfigurationErrors.push(message),
        tempRoot
      );
      assert.deepEqual(currentConfigurationErrors, []);

      const oxlintConfigurationPath = path.join(tempRoot, ".oxlintrc.json");
      const currentOxlintConfiguration = JSON.parse(
        await fs.readFile(oxlintConfigurationPath, "utf8")
      ) as Record<string, unknown>;
      for (const { expectedFailure, mutate } of [
        {
          expectedFailure:
            "overrides is not an allowed repository Oxlint setting",
          mutate: (configuration: Record<string, unknown>) => {
            configuration.overrides = [];
          }
        },
        ...oxlintPolicyMutations
      ]) {
        const mutatedConfiguration = cloneJsonRecord(
          currentOxlintConfiguration
        );
        mutate(mutatedConfiguration);
        await fs.writeFile(
          oxlintConfigurationPath,
          `${JSON.stringify(mutatedConfiguration, undefined, 2)}\n`,
          "utf8"
        );
        const policyErrors: string[] = [];
        await validateOxcConfigurationFiles(
          (message) => policyErrors.push(message),
          tempRoot
        );
        assert.equal(policyErrors.length, 1);
        assert.ok(policyErrors[0]?.includes(expectedFailure));
        assert.ok(
          policyErrors[0]?.includes(
            "Fix the affected code; only for a direct contract conflict"
          )
        );
      }
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }
);

test("repository permission rules cover environment setup without stale or blanket entries", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills permission rules ")
  );
  try {
    const rulesDirectory = path.join(tempRoot, ".codex", "rules");
    await fs.mkdir(rulesDirectory, { recursive: true });
    const currentRules = await fs.readFile(
      path.join(workspaceRoot, ".codex", "rules", "bun.rules"),
      "utf8"
    );
    const rulesPath = path.join(rulesDirectory, "bun.rules");
    await fs.writeFile(rulesPath, currentRules, "utf8");

    const currentErrors: string[] = [];
    await validateRepositoryPermissionRules(
      (message) => currentErrors.push(message),
      tempRoot
    );
    assert.deepEqual(currentErrors, []);

    const removedHookEntry = [
      "scripts",
      ["setup-git-hooks", "ts"].join(".")
    ].join("/");
    const staleRules =
      currentRules.replace(
        'prefix_rule(pattern=["node", "scripts/setup-repository.js"], decision="prompt")',
        `prefix_rule(pattern=["bun", "${removedHookEntry}"], decision="prompt")`
      ) +
      'prefix_rule(pattern=["bun", "run", "task-graph"], decision="allow")\n';
    await fs.writeFile(rulesPath, staleRules, "utf8");
    const staleErrors: string[] = [];
    await validateRepositoryPermissionRules(
      (message) => staleErrors.push(message),
      tempRoot
    );
    assert.ok(
      staleErrors.some((message) =>
        message.includes("must prompt node scripts/setup-repository.js")
      )
    );
    assert.ok(
      staleErrors.some((message) =>
        message.includes(`must not reference removed entry ${removedHookEntry}`)
      )
    );
    assert.ok(
      staleErrors.some((message) =>
        message.includes("must not blanket allow bun run task-graph")
      )
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
