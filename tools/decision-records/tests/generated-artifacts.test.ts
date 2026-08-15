import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { decisionIndexJsonSchema } from "../src/decision-index-json-schema.ts";
import {
  generatedCliPath,
  generatedDeclarationDirectory,
  generatedDeclarationPath,
  generatedSchemaPath
} from "./support.ts";

const execFileAsync = promisify(execFile);

type SourceMapMetadata = {
  sourceRoot: string;
  sources: string[];
};

function isSourceMapMetadata(value: unknown): value is SourceMapMetadata {
  return (
    typeof value === "object" &&
    value !== null &&
    "sourceRoot" in value &&
    typeof value.sourceRoot === "string" &&
    "sources" in value &&
    Array.isArray(value.sources) &&
    value.sources.every((source) => typeof source === "string")
  );
}

test("generated decision declarations expose a portable CLI API", async () => {
  const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(
    declarationSource,
    /export \* from "\.\/decision-records-sdk\/cli\.mjs";/
  );
  const declarationFiles = (await fs.readdir(generatedDeclarationDirectory))
    .filter((filename) => filename.endsWith(".d.mts"))
    .sort();
  assert.deepEqual(declarationFiles, [
    "cli.d.mts",
    "index.d.mts",
    "scan.d.mts",
    "types.d.mts"
  ]);
  const declarations = await Promise.all(
    declarationFiles.map(
      async (filename) =>
        await fs.readFile(
          path.join(generatedDeclarationDirectory, filename),
          "utf8"
        )
    )
  );
  const declarationTree = [declarationSource, ...declarations].join("\n");
  for (const generatedDeclaration of [declarationSource, ...declarations]) {
    assert.match(
      generatedDeclaration,
      /Generated decision records TypeScript declaration/
    );
    assert.doesNotMatch(generatedDeclaration, /["']\.\.?\/[^"']+\.ts["']/);
  }
  for (const publicType of [
    "DecisionId",
    "DecisionTag",
    "DecisionIndex",
    "DecisionIndexEntry",
    "DecisionIndexStoredEntry",
    "DecisionSourceRevision",
    "DecisionScanOptions",
    "DecisionValidationResult"
  ]) {
    assert.match(declarationTree, new RegExp(`export type ${publicType}\\b`));
  }
  for (const publicExport of [
    "runDecisionRecordsCli",
    "scanDecisionRecords",
    "validateDecisionRecords"
  ]) {
    assert.match(declarationTree, new RegExp(`\\b${publicExport}\\b`));
  }
  assert.doesNotMatch(declarationTree, /index-runtime/);

  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-declaration-consumer-")
  );
  try {
    await fs.copyFile(
      generatedCliPath,
      path.join(temporaryDirectory, "decision-records.mjs")
    );
    await fs.copyFile(
      generatedDeclarationPath,
      path.join(temporaryDirectory, "decision-records.d.mts")
    );
    await fs.cp(
      generatedDeclarationDirectory,
      path.join(temporaryDirectory, "decision-records-sdk"),
      { recursive: true }
    );
    const consumerPath = path.join(temporaryDirectory, "consumer.mts");
    await fs.writeFile(
      consumerPath,
      [
        'import { runDecisionRecordsCli, scanDecisionRecords, validateDecisionRecords } from "./decision-records.mjs";',
        "import type {",
        "  DecisionId, DecisionIndex, DecisionIndexEntry, DecisionIndexStoredEntry, DecisionTag,",
        "  DecisionScan, DecisionScanOptions, DecisionSourceRevision, DecisionValidationResult",
        '} from "./decision-records.mjs";',
        "declare const decisionId: DecisionId;",
        "declare const index: DecisionIndex;",
        "declare const indexEntry: DecisionIndexEntry;",
        "declare const storedEntry: DecisionIndexStoredEntry;",
        "declare const revision: DecisionSourceRevision;",
        "const tags: DecisionTag[] = storedEntry.keys.tag;",
        'const statuses: ["active" | "archived"] = storedEntry.keys.status;',
        "const entries: Record<DecisionId, DecisionIndexStoredEntry> = index.entries;",
        "const revisions: Record<DecisionId, string> = revision.entries;",
        "const keyDefinitions: [",
        '  { name: "tag"; mode: "exact" },',
        '  { name: "status"; mode: "exact" },',
        '  { name: "alignment"; mode: "exact" }',
        "] = index.keyDefinitions;",
        "const options: DecisionScanOptions = {};",
        "const scan: Promise<DecisionScan> = scanDecisionRecords(options);",
        "const validation: Promise<DecisionValidationResult> = validateDecisionRecords(options);",
        "void runDecisionRecordsCli([]);",
        "void decisionId;",
        "void index;",
        "void indexEntry;",
        "void storedEntry;",
        "void revision;",
        "void tags;",
        "void statuses;",
        "void entries;",
        "void revisions;",
        "void keyDefinitions;",
        "void scan;",
        "void validation;",
        ""
      ].join("\n"),
      "utf8"
    );
    const packageRequire = createRequire(import.meta.url);
    const compilerRoot = path.dirname(
      packageRequire.resolve("@typescript/native-preview/package.json")
    );
    await execFileAsync(
      process.execPath,
      [
        path.join(compilerRoot, "bin", "tsgo"),
        "--ignoreConfig",
        "--noEmit",
        "--target",
        "ES2024",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--strict",
        "--skipLibCheck",
        "false",
        consumerPath
      ],
      { cwd: temporaryDirectory, windowsHide: true }
    );
  } finally {
    await fs.rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test("generated decision schema matches the runtime index schema", async () => {
  const distributedSchema: unknown = JSON.parse(
    await fs.readFile(generatedSchemaPath, "utf8")
  );
  assert.deepEqual(distributedSchema, decisionIndexJsonSchema);
  assert.equal(decisionIndexJsonSchema.properties.definitionVersion.const, 6);
  assert.deepEqual(decisionIndexJsonSchema.properties.keyDefinitions.const, [
    { name: "tag", mode: "exact" },
    { name: "status", mode: "exact" },
    { name: "alignment", mode: "exact" }
  ]);
  assert.ok(
    decisionIndexJsonSchema.$defs.state.required.includes("sourcePath")
  );
  assert.ok(decisionIndexJsonSchema.$defs.state.required.includes("tags"));
});

test("generated decision bundle and source map retain portable metadata", async () => {
  const cliSource = await fs.readFile(generatedCliPath, "utf8");
  assert.match(cliSource, /Source path: tools\/decision-records\/src\/cli\.ts/);
  assert.match(cliSource, /Rebuild: bun run sync:decision-records-cli/);
  assert.match(cliSource, /sourceMappingURL=decision-records\.mjs\.map/);

  const sourceMap: unknown = JSON.parse(
    await fs.readFile(`${generatedCliPath}.map`, "utf8")
  );
  if (!isSourceMapMetadata(sourceMap)) {
    assert.fail(
      "Generated decision records source map must expose sourceRoot and sources"
    );
  }
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("tools/decision-records/src/cli.ts"));
  assert.ok(
    sourceMap.sources.every(
      (source) => !path.isAbsolute(source) && !source.includes("\\")
    )
  );
});
