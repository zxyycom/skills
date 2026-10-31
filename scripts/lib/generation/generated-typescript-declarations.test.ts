import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { rootDir } from "../project.ts";
import { buildGeneratedTypeScriptDeclarationArtifacts } from "./generated-typescript-declarations.ts";

async function withDeclarationSources(
  files: Readonly<Record<string, string>>,
  operation: (
    options: Parameters<typeof buildGeneratedTypeScriptDeclarationArtifacts>[0]
  ) => Promise<void>
): Promise<void> {
  const fixtureRoot = path.join(rootDir, ".log", "vibe-check", "fixtures");
  await fs.mkdir(fixtureRoot, { recursive: true });
  const directory = await fs.mkdtemp(
    path.join(fixtureRoot, "declaration-tree-")
  );
  try {
    for (const [name, content] of Object.entries(files)) {
      const target = path.join(directory, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    }
    await operation({
      declarationArtifactName: "fixture declaration",
      declarationEntryOutputPath: path.join(directory, "package", "api.d.mts"),
      declarationOutputDirectory: path.join(directory, "package", "sdk"),
      entrySourcePath: path
        .relative(rootDir, path.join(directory, "src", "cli.ts"))
        .replace(/\\/gu, "/"),
      rebuildCommand: "fixture",
      repository: "fixture/repository",
      skillSourcePath: "skills/fixture",
      workspaceRoot: rootDir
    });
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("generated declaration closures preserve nested modules and parent-relative imports", async () => {
  await withDeclarationSources(
    {
      "src/cli.ts": [
        'import { internalValue } from "./internal.ts";',
        'export type { Query } from "./query/types.ts";',
        "export function queryValue(): number { return internalValue(); }",
        ""
      ].join("\n"),
      "src/internal.ts":
        "export function internalValue(): number { return 1; }\n",
      "src/query/types.ts":
        'import type { Model } from "../model.ts"; export type Query = { model: Model };\n',
      "src/model.ts": "export type Model = { id: string };\n"
    },
    async (options) => {
      const artifacts =
        await buildGeneratedTypeScriptDeclarationArtifacts(options);
      assert.deepEqual(
        artifacts
          .map(({ path: filename }) =>
            path
              .relative(
                path.dirname(options.declarationOutputDirectory),
                filename
              )
              .replace(/\\/gu, "/")
          )
          .sort(),
        [
          "api.d.mts",
          "sdk/cli.d.mts",
          "sdk/model.d.mts",
          "sdk/query/types.d.mts"
        ]
      );
      assert.match(
        artifacts.find(({ path: filename }) =>
          filename.endsWith(`${path.sep}cli.d.mts`)
        )?.content ?? "",
        /from "\.\/query\/types\.mjs"/u
      );
      assert.match(
        artifacts.find(({ path: filename }) =>
          filename.endsWith(`${path.sep}types.d.mts`)
        )?.content ?? "",
        /from "\.\.\/model\.mjs"/u
      );
    }
  );
});

test("generated declaration closures reject dependencies outside their source boundary", async () => {
  await withDeclarationSources(
    {
      "src/cli.ts": 'export type { Outside } from "../outside.ts";\n',
      "outside.ts": "export type Outside = string;\n"
    },
    async (options) => {
      await assert.rejects(
        buildGeneratedTypeScriptDeclarationArtifacts(options),
        /unsupported declaration dependency \.\.\/outside\.mjs/u
      );
    }
  );
});
