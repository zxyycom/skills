import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildGeneratedDeclaration,
  normalizeSourceMap
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
const relativeWorkspaceSource = path.relative(generatedSourceMapDirectory, workspaceSource);

const normalized = JSON.parse(normalizeSourceMap(
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
)) as ParsedSourceMap;

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
  () => normalizeSourceMap(
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

console.log("Generated file tests passed.");
