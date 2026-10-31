import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { collectProjectFiles } from "@zxyycom/vibe-check";
import * as v from "valibot";
import { createVibeNativeChecks } from "./lib/vibe-gate.ts";
import { maintainedMarkdownFiles } from "./lib/vibe-gate/impact-paths.ts";
import { withTemporaryDirectory } from "./vibe-check-test-support.ts";

const filesSchema = v.object({
  patterns: v.array(v.string()),
  useDefaultExcludes: v.optional(v.boolean())
});
const excludedMaterialDirectories = [
  ...[
    ".cache",
    ".git",
    ".log",
    ".pytest_cache",
    ".tmp",
    ".venv",
    ".vibe-check",
    "__pycache__",
    "artifacts",
    "coverage",
    "dist",
    "generated",
    "node_modules",
    "target",
    "tmp",
    "vendor",
    "venv"
  ].flatMap((folder) => [folder, `scripts/build/${folder}`]),
  "build",
  "scripts/build/build",
  "scripts/build/nested/build",
  "scripts/other/build",
  "scripts-copy/build",
  "scripts2/build",
  "scripts/building/build",
  "scripts/building/deep/build",
  "scripts/buildish/build",
  "scripts/builds/build",
  "tools/alpha/build"
];

async function writeSelectionFiles(
  directory: string,
  files: readonly string[]
): Promise<void> {
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(directory, file)), {
      recursive: true
    });
    await fs.writeFile(path.join(directory, file), "fixture\n");
  }
}

function selectedFiles(directory: string, options: unknown): string[] {
  return collectProjectFiles({
    projectRoot: directory,
    selection: v.parse(filesSchema, options)
  }).toSorted();
}

function codeAreaOptions(
  optionsById: ReadonlyMap<string, unknown>,
  id: string,
  role: string
) {
  const options = v.parse(
    v.looseObject({
      codeAreas: v.record(v.string(), v.looseObject({ files: filesSchema }))
    }),
    optionsById.get(id)
  );
  const area = options.codeAreas[role];
  assert.ok(area, `missing ${id}: ${role}`);
  return area;
}

test("all three native code selections include build source while excluding dependencies and outputs", async () => {
  await withTemporaryDirectory("gate-native-build-code-", async (directory) => {
    const product = ["tools/alpha/src/source.ts"];
    const automation = [
      "scripts/build/source.ts",
      "scripts/build/nested/src/source.ts",
      "scripts/lib/source.ts"
    ];
    const tests = [
      "scripts/build/source.test.ts",
      "scripts/build/nested/source.test.ts",
      "tools/alpha/tests/source.test.ts"
    ];
    const expected = [...product, ...automation, ...tests].toSorted();
    await writeSelectionFiles(directory, [
      ...expected,
      ...excludedMaterialDirectories.map((folder) => `${folder}/output.ts`),
      "scripts/build/source.generated.ts",
      "skills/alpha/scripts/runtime/copied.ts",
      "docs/investigations/_resources/source.ts"
    ]);
    const optionsById = new Map(
      createVibeNativeChecks(directory).map((check) => [
        check.checkId,
        check.options
      ])
    );
    for (const id of ["duplicate-detection", "file-metrics"]) {
      const area = codeAreaOptions(optionsById, id, "maintained");
      assert.deepEqual(selectedFiles(directory, area.files), expected, id);
    }
    for (const [role, paths] of Object.entries({
      product,
      automation,
      tests
    })) {
      const area = codeAreaOptions(optionsById, "function-metrics", role);
      assert.deepEqual(
        selectedFiles(directory, area.files),
        paths.toSorted(),
        role
      );
    }
  });
});

test("native JSON Markdown and secret selections share the build-source exception and default guards", async () => {
  await withTemporaryDirectory(
    "gate-native-build-materials-",
    async (directory) => {
      const owned = [
        "scripts/build/settings.json",
        "scripts/build/readme.md",
        "scripts/build/other.MARKDOWN",
        "scripts/build/source.ts",
        "scripts/build/nested/src/settings.json",
        "scripts/build/nested/src/readme.md",
        "scripts/build/nested/src/other.MARKDOWN",
        "scripts/build/nested/src/source.ts"
      ];
      await writeSelectionFiles(directory, [
        ...owned,
        "scripts/build/settings.generated.json",
        "scripts/build/readme.generated.md",
        "scripts/build/source.generated.ts",
        ...excludedMaterialDirectories.flatMap((folder) => [
          `${folder}/output.json`,
          `${folder}/output.md`,
          `${folder}/source.ts`
        ])
      ]);
      const checks = createVibeNativeChecks(directory);
      const json = [
        "scripts/build/settings.json",
        "scripts/build/nested/src/settings.json"
      ].toSorted();
      const markdown = [
        "scripts/build/readme.md",
        "scripts/build/other.MARKDOWN",
        "scripts/build/nested/src/readme.md",
        "scripts/build/nested/src/other.MARKDOWN"
      ].toSorted();
      for (const [id, expected] of [
        ["json-validation", json],
        ["markdown-link-validation", markdown],
        ["markdown-lint", markdown],
        [
          "secret-detection",
          owned.filter((file) => !file.endsWith(".MARKDOWN")).toSorted()
        ]
      ] as const) {
        const check = checks.find(({ checkId }) => checkId === id);
        const options = v.parse(
          v.looseObject({ files: filesSchema }),
          check?.options
        );
        assert.deepEqual(selectedFiles(directory, options.files), expected, id);
      }
      assert.deepEqual(
        selectedFiles(directory, maintainedMarkdownFiles),
        markdown
      );
    }
  );
});
