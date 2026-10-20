import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildGeneratedDeclaration,
  normalizeSourceMap,
  removeStaleGeneratedTypeScriptDeclarations,
  syncGeneratedFile
} from "./generated-file.ts";

type ParsedSourceMap = {
  sourceRoot: string;
  sources: string[];
  sourcesContent: Array<string | null>;
};

const tempRoot = path.join(os.tmpdir(), "generated-file-source-map-test");
const workspaceRoot = path.join(tempRoot, "workspace");
const generatedSourceMapDirectory = path.join(tempRoot, "bundle");
const publishedSourceMapDirectory = path.join(
  workspaceRoot,
  "skills",
  "example",
  "scripts"
);
const workspaceSource = path.join(workspaceRoot, "scripts", "source.ts");
const relativeWorkspaceSource = path.relative(
  generatedSourceMapDirectory,
  workspaceSource
);

test("source map normalization keeps workspace sources portable", () => {
  const normalized = JSON.parse(
    normalizeSourceMap(
      JSON.stringify({
        mappings: "",
        sources: [relativeWorkspaceSource, workspaceSource],
        sourcesContent: ["first\r\nsecond\rthird\n", "already\nnormalized\n"],
        version: 3
      }),
      {
        generatedSourceMapDirectory,
        publishedSourceMapDirectory,
        workspaceRoot
      }
    )
  ) as ParsedSourceMap;

  assert.deepEqual(normalized.sources, [
    "scripts/source.ts",
    "scripts/source.ts"
  ]);
  assert.deepEqual(normalized.sourcesContent, [
    "first\nsecond\nthird\n",
    "already\nnormalized\n"
  ]);
  assert.equal(normalized.sourceRoot, "../../../");

  const outsideSource = path.join(tempRoot, "outside", "source.ts");
  assert.throws(
    () =>
      normalizeSourceMap(
        JSON.stringify({
          mappings: "",
          sources: [path.relative(generatedSourceMapDirectory, outsideSource)],
          version: 3
        }),
        {
          generatedSourceMapDirectory,
          publishedSourceMapDirectory,
          workspaceRoot
        }
      ),
    /Bun source map contains a source outside the workspace/
  );
});

test("generated declarations normalize line endings and preserve the banner", async () => {
  const declarationTempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "generated-declaration-test-")
  );
  try {
    const declarationPath = path.join(declarationTempRoot, "tool.d.mts");
    await fs.writeFile(
      declarationPath,
      "export declare function run(): Promise<number>;\r\n",
      "utf8"
    );
    assert.equal(
      await buildGeneratedDeclaration({
        banner: "/* Generated declaration. */",
        sourcePath: declarationPath
      }),
      [
        "/* Generated declaration. */",
        "export declare function run(): Promise<number>;",
        ""
      ].join("\n")
    );
  } finally {
    await fs.rm(declarationTempRoot, { force: true, recursive: true });
  }
});

test("generated file checks ignore line-ending differences and detect drift", async () => {
  const generatedFileTempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "generated-file-line-endings-test-")
  );
  try {
    const generatedFilePath = path.join(generatedFileTempRoot, "generated.txt");
    await fs.writeFile(generatedFilePath, "first\r\nsecond\r\n", "utf8");
    assert.equal(
      await syncGeneratedFile(generatedFilePath, "first\nsecond\n", "check"),
      "current"
    );
    assert.equal(
      await syncGeneratedFile(generatedFilePath, "first\nchanged\n", "check"),
      "stale"
    );
  } finally {
    await fs.rm(generatedFileTempRoot, { force: true, recursive: true });
  }
});

test("generated file sync rejects symbolic-link artifact paths", async () => {
  const generatedFileTempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "generated-file-symlink-test-")
  );
  try {
    const protectedPath = path.join(generatedFileTempRoot, "protected.txt");
    const generatedFilePath = path.join(generatedFileTempRoot, "generated.txt");
    await fs.writeFile(protectedPath, "must not change\n", "utf8");
    await fs.symlink(protectedPath, generatedFilePath);

    for (const mode of ["check", "write"] as const) {
      await assert.rejects(
        syncGeneratedFile(generatedFilePath, "generated content\n", mode),
        /Generated artifact path must be a regular file/
      );
    }
    assert.equal(await fs.readFile(protectedPath, "utf8"), "must not change\n");
    assert.equal((await fs.lstat(generatedFilePath)).isSymbolicLink(), true);
  } finally {
    await fs.rm(generatedFileTempRoot, { force: true, recursive: true });
  }
});

test("generated declaration cleanup only removes verified stale declaration files", async () => {
  const generatedDeclarationsTempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "generated-declaration-cleanup-test-")
  );
  try {
    const declarationOutputDirectory = path.join(
      generatedDeclarationsTempRoot,
      "declarations"
    );
    const artifactName = "example TypeScript declaration";
    const generatedDeclaration = [
      "/*",
      ` * Generated ${artifactName}. Do not edit this file directly.`,
      " */",
      "export {};",
      ""
    ].join("\n");
    const expectedDeclarationPath = path.join(
      declarationOutputDirectory,
      "current.d.mts"
    );
    const staleDeclarationPath = path.join(
      declarationOutputDirectory,
      "stale.d.mts"
    );
    const unmanagedDeclarationPath = path.join(
      declarationOutputDirectory,
      "manual.d.mts"
    );
    const unexpectedDirectoryPath = path.join(
      declarationOutputDirectory,
      "unexpected"
    );
    const linkedDeclarationPath = path.join(
      declarationOutputDirectory,
      "linked.d.mts"
    );
    await fs.mkdir(unexpectedDirectoryPath, { recursive: true });
    await Promise.all([
      fs.writeFile(expectedDeclarationPath, generatedDeclaration, "utf8"),
      fs.writeFile(staleDeclarationPath, generatedDeclaration, "utf8"),
      fs.writeFile(
        unmanagedDeclarationPath,
        "export type Manual = true;\n",
        "utf8"
      ),
      fs.symlink(unmanagedDeclarationPath, linkedDeclarationPath)
    ]);
    const options = {
      declarationArtifactName: artifactName,
      declarationOutputDirectory,
      expectedPaths: new Set([expectedDeclarationPath]),
      sourcePath: "tools/example/src/cli.ts",
      workspaceRoot: generatedDeclarationsTempRoot
    };

    assert.deepEqual(
      await removeStaleGeneratedTypeScriptDeclarations({
        ...options,
        mode: "check"
      }),
      { changed: true, hasUnsupportedEntries: true }
    );
    assert.equal((await fs.lstat(staleDeclarationPath)).isFile(), true);

    assert.deepEqual(
      await removeStaleGeneratedTypeScriptDeclarations({
        ...options,
        mode: "write"
      }),
      { changed: true, hasUnsupportedEntries: true }
    );
    await assert.rejects(fs.lstat(staleDeclarationPath), { code: "ENOENT" });
    assert.equal((await fs.lstat(expectedDeclarationPath)).isFile(), true);
    assert.equal((await fs.lstat(unmanagedDeclarationPath)).isFile(), true);
    assert.equal((await fs.lstat(unexpectedDirectoryPath)).isDirectory(), true);
    assert.equal(
      (await fs.lstat(linkedDeclarationPath)).isSymbolicLink(),
      true
    );
  } finally {
    await fs.rm(generatedDeclarationsTempRoot, {
      force: true,
      recursive: true
    });
  }
});

test("source runtime synchronization detects drift read-only and preserves unowned files", async () => {
  const { syncSourceRuntimeArtifacts } = await import("./source-runtime.ts");
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "source-runtime-sync-test-")
  );
  const skillName = "example";
  const root = path.join(workspaceRoot, "skills", skillName);
  const expectedPath = path.join(
    root,
    "scripts/runtime/tools/example/src/index.ts"
  );
  const stalePath = path.join(root, "scripts/runtime/tools/example/src/old.ts");
  const customPath = path.join(root, "scripts/runtime/local-notes.txt");
  try {
    await fs.mkdir(path.dirname(expectedPath), { recursive: true });
    await fs.writeFile(expectedPath, "drift\n");
    await fs.writeFile(
      stalePath,
      "/*\n * Synced TypeScript runtime; stale\n */\n"
    );
    await fs.writeFile(customPath, "local customization\n");
    const artifacts = [
      { path: expectedPath, content: "export const value = 1;\n" }
    ];
    assert.equal(
      await syncSourceRuntimeArtifacts(artifacts, {
        mode: "check",
        skillName,
        retiredPaths: [],
        workspaceRoot
      }),
      true
    );
    assert.equal(await fs.readFile(expectedPath, "utf8"), "drift\n");
    assert.equal((await fs.stat(stalePath)).isFile(), true);
    assert.equal(
      await syncSourceRuntimeArtifacts(artifacts, {
        mode: "write",
        skillName,
        retiredPaths: [],
        workspaceRoot
      }),
      true
    );
    assert.equal(
      await fs.readFile(expectedPath, "utf8"),
      artifacts[0]?.content
    );
    await assert.rejects(fs.stat(stalePath), { code: "ENOENT" });
    assert.equal(
      await fs.readFile(customPath, "utf8"),
      "local customization\n"
    );
    assert.equal(
      await syncSourceRuntimeArtifacts(artifacts, {
        mode: "check",
        skillName,
        retiredPaths: [],
        workspaceRoot
      }),
      false
    );
  } finally {
    await fs.rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("source runtime generation shares invocation facts and refreshes them for later source changes", async () => {
  const { buildSourceRuntimeArtifacts, captureSourceRuntimeFacts } =
    await import("./source-runtime.ts");
  const fixture = await fs.mkdtemp(
    path.join(os.tmpdir(), "source-runtime-facts-test-")
  );
  const sourceDirectory = path.join(fixture, "tools/example/src");
  const entryPath = path.join(sourceDirectory, "index.ts");
  const sourcePath = "tools/example/src/index.ts";
  const options = {
    workspaceRoot: fixture,
    skillName: "source-runtime-facts-test-alpha",
    rebuildCommand: "bun run sync:skill-updaters",
    nodeEngine: ">=24.18",
    entries: [{ sourcePath, outputName: "fixture.ts", body: "" }]
  };
  try {
    await fs.mkdir(sourceDirectory, { recursive: true });
    await fs.writeFile(
      path.join(fixture, "package.json"),
      JSON.stringify({ packageManager: "pnpm@11.7.0", devDependencies: {} })
    );
    await fs.writeFile(
      path.join(sourceDirectory, "first.ts"),
      "export const value = 1;\n"
    );
    await fs.writeFile(
      path.join(sourceDirectory, "second.ts"),
      "export const value = 2;\n"
    );
    await fs.writeFile(entryPath, 'export { value } from "./first.ts";\n');
    const firstFacts = await captureSourceRuntimeFacts(fixture);
    assert.equal(firstFacts.workspaceRoot, fixture);
    assert.ok(
      [...firstFacts.references.keys()].every((file) =>
        file.startsWith(fixture + path.sep)
      )
    );
    assert.equal(Object.isFrozen(firstFacts), true);
    assert.equal(Object.isFrozen(firstFacts.dependencies), true);
    await assert.rejects(
      buildSourceRuntimeArtifacts(
        { ...options, workspaceRoot: path.join(fixture, "other") },
        firstFacts
      ),
      /another workspace/u
    );
    const alpha = await buildSourceRuntimeArtifacts(options, firstFacts);
    assert.ok(
      alpha.every((artifact) => artifact.path.startsWith(fixture + path.sep))
    );
    const beta = await buildSourceRuntimeArtifacts(
      { ...options, skillName: "source-runtime-facts-test-beta" },
      firstFacts
    );
    const sources = (artifacts: typeof alpha) =>
      artifacts
        .map((artifact) => artifact.sourcePath)
        .filter((file) => file !== undefined);
    assert.deepEqual(sources(alpha), sources(beta));
    assert.ok(sources(alpha).some((file) => file.endsWith("/first.ts")));
    assert.equal(
      sources(alpha).some((file) => file.endsWith("/second.ts")),
      false
    );

    await fs.writeFile(entryPath, 'export { value } from "./second.ts";\n');
    const nextFacts = await captureSourceRuntimeFacts(fixture);
    assert.notEqual(nextFacts, firstFacts);
    assert.notEqual(nextFacts.references, firstFacts.references);
    const refreshed = await buildSourceRuntimeArtifacts(options, nextFacts);
    assert.ok(sources(refreshed).some((file) => file.endsWith("/second.ts")));
    assert.equal(
      sources(refreshed).some((file) => file.endsWith("/first.ts")),
      false
    );
    assert.deepEqual(await buildSourceRuntimeArtifacts(options), refreshed);
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
