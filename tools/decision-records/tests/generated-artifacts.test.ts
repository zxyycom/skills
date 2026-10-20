import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { Ajv2020 } from "ajv/dist/2020.js";
import { decisionIndexJsonSchema } from "../src/decision-index-json-schema.ts";
import {
  generatedCliPath,
  generatedDeclarationDirectory,
  generatedDeclarationPath,
  generatedSchemaPath,
  fixtureRoot
} from "./support.ts";

const execFileAsync = promisify(execFile);

type DecisionIndexFixture = {
  entries: Record<string, Record<string, unknown>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    "cli-io.d.mts",
    "cli.d.mts",
    "decision-rename.d.mts",
    "index.d.mts",
    "scan-contracts.d.mts",
    "scan-relations.d.mts",
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
    "DecisionSourceRevision",
    "DecisionScanOptions",
    "DecisionValidationResult",
    "DecisionRenameOptions",
    "DecisionRenamePlan",
    "DecisionRenameResult"
  ]) {
    assert.match(declarationTree, new RegExp(`export type ${publicType}\\b`));
  }
  for (const publicExport of [
    "runDecisionRecordsCli",
    "renameDecisionRecord",
    "scanDecisionRecords",
    "missingIndexedDecisionError",
    "unindexedDecisionError",
    "validateDecisionRecords"
  ]) {
    assert.match(declarationTree, new RegExp(`\\b${publicExport}\\b`));
  }
  assert.doesNotMatch(declarationTree, /index-runtime/);

  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-declaration-consumer-")
  );
  try {
    await fs.cp(path.dirname(generatedCliPath), temporaryDirectory, {
      recursive: true
    });
    await fs.symlink(
      path.join(
        path.resolve(path.dirname(generatedCliPath), "../../.."),
        "node_modules"
      ),
      path.join(temporaryDirectory, "node_modules"),
      process.platform === "win32" ? "junction" : "dir"
    );
    await fs.writeFile(
      path.join(temporaryDirectory, "package.json"),
      '{"type":"module"}'
    );
    const consumerPath = path.join(temporaryDirectory, "consumer.mts");
    await fs.writeFile(
      consumerPath,
      [
        'import { renameDecisionRecord, runDecisionRecordsCli, scanDecisionRecords, validateDecisionRecords } from "./decision-records.ts";',
        "import type {",
        "  DecisionId, DecisionIndex, DecisionIndexEntry, DecisionIndexState, DecisionTag,",
        "  DecisionRenameOptions, DecisionRenamePlan, DecisionRenameResult, DecisionScan, DecisionScanOptions, DecisionSourceRevision, DecisionValidationResult",
        '} from "./decision-records.ts";',
        "declare const decisionId: DecisionId;",
        "declare const index: DecisionIndex;",
        "declare const indexEntry: DecisionIndexEntry;",
        "declare const state: DecisionIndexState;",
        "declare const revision: DecisionSourceRevision;",
        "const tags: DecisionTag[] = state.tags;",
        'const status: "active" | "archived" = state.status;',
        "const entries: Record<DecisionId, DecisionIndexState> = index.entries;",
        "const revisions: Record<DecisionId, string> = revision.entries;",
        "const options: DecisionScanOptions = {};",
        "const scan: Promise<DecisionScan> = scanDecisionRecords(options);",
        "const validation: Promise<DecisionValidationResult> = validateDecisionRecords(options);",
        'const renameOptions: DecisionRenameOptions = { source: "legacy", target: "260101-renamed" };',
        "const renamed: Promise<DecisionRenameResult> = renameDecisionRecord(renameOptions);",
        "declare const renamePlan: DecisionRenamePlan;",
        "void runDecisionRecordsCli([]);",
        "void renamePlan;",
        "void renamed;",
        "void decisionId;",
        "void index;",
        "void indexEntry;",
        "void state;",
        "void revision;",
        "void tags;",
        "void status;",
        "void entries;",
        "void revisions;",
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
        "--types",
        "node",
        "--allowImportingTsExtensions",
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
  assert.ok(isRecord(distributedSchema));
  assert.deepEqual(distributedSchema, decisionIndexJsonSchema);
  assert.equal(decisionIndexJsonSchema.properties.definitionVersion.const, 11);
  assert.ok(decisionIndexJsonSchema.$defs.state.required.includes("alignment"));
  assert.equal(decisionIndexJsonSchema.properties.schemaVersion.const, 4);
  assert.ok(
    decisionIndexJsonSchema.$defs.state.required.includes("sourcePath")
  );
  assert.ok(decisionIndexJsonSchema.$defs.state.required.includes("tags"));

  const validateConsumer = new Ajv2020({
    allErrors: true,
    strict: false
  }).compile<DecisionIndexFixture>(distributedSchema);
  const validIndex: unknown = JSON.parse(
    await fs.readFile(
      path.join(fixtureRoot, "docs", "decisions", "decision-index.json"),
      "utf8"
    )
  );
  if (!validateConsumer(validIndex)) {
    assert.fail(JSON.stringify(validateConsumer.errors));
  }

  for (const decisionId of ["use-generated-cli", "260710-use-source-cli"]) {
    for (const invalidAlignment of ["missing", "null"] as const) {
      const invalid: DecisionIndexFixture = structuredClone(validIndex);
      if (invalidAlignment === "missing") {
        delete invalid.entries[decisionId]!.alignment;
      } else {
        invalid.entries[decisionId]!.alignment = null;
      }
      assert.equal(
        validateConsumer(invalid),
        false,
        `${decisionId}/${invalidAlignment}: ${JSON.stringify(
          validateConsumer.errors
        )}`
      );
    }
  }

  for (const invalidName of ["missing", "empty", "blank"] as const) {
    const invalid: DecisionIndexFixture = structuredClone(validIndex);
    if (invalidName === "missing") {
      delete invalid.entries["use-generated-cli"]!.name;
    } else {
      invalid.entries["use-generated-cli"]!.name =
        invalidName === "empty" ? "" : "   ";
    }
    assert.equal(
      validateConsumer(invalid),
      false,
      `${invalidName}: ${JSON.stringify(validateConsumer.errors)}`
    );
  }
});

test("generated decision TS closure retains portable metadata", async () => {
  const cliSource = await fs.readFile(generatedCliPath, "utf8");
  assert.match(cliSource, /Source path: tools\/decision-records\/src\/cli\.ts/);
  assert.match(cliSource, /Rebuild: bun run sync:decision-records-cli/);
  const entry = await import(
    new URL(
      "../../../skills/decision-records/scripts/decision-records.ts",
      import.meta.url
    ).href
  );
  const runtime = await import(
    new URL(
      "../../../skills/decision-records/scripts/runtime/tools/decision-records/src/cli.ts",
      import.meta.url
    ).href
  );
  assert.equal(entry.scanDecisionRecords, runtime.scanDecisionRecords);
  assert.equal(entry.renameDecisionRecord, runtime.renameDecisionRecord);

  assert.match(cliSource, /runtime\/tools\/decision-records\/src\/cli\.ts/u);
  await assert.rejects(
    fs.stat(generatedCliPath.replace(/\.ts$/u, ".mjs.map")),
    { code: "ENOENT" }
  );
  assert.equal(
    cliSource.includes(
      path.resolve(path.dirname(generatedCliPath), "../../..")
    ),
    false
  );
});
