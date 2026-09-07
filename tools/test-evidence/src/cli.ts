import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";
import * as v from "valibot";
import {
  Command,
  CommanderError,
  InvalidArgumentError,
  Option
} from "commander";
import { isMainModule } from "../../shared/src/node/main-module.ts";
import {
  listTestEvidenceTags,
  queryTestEvidence,
  searchTestEvidence,
  showTestEvidenceCase,
  stageTestEvidenceIndex,
  syncTestEvidenceIndex,
  testEvidenceQueryDefaultLimit,
  validateTestEvidence,
  validateTestEvidenceReferences
} from "./core.ts";
import {
  testEvidenceCaseIdSchema,
  testEvidenceTagSchema,
  testEvidenceTestIdSchema
} from "./core-schemas.ts";

export type TestEvidenceCatalogCliOptions = Readonly<{
  cwd?: string;
  io?: Readonly<{
    stdout: (text: string) => void;
    stderr: (text: string) => void;
  }>;
}>;
export async function runTestEvidenceCatalogCli(
  argv: readonly string[] = process.argv.slice(2),
  options: TestEvidenceCatalogCliOptions = {}
): Promise<number> {
  const io = options.io ?? {
    stdout: (text: string) => process.stdout.write(text),
    stderr: (text: string) => process.stderr.write(text)
  };
  const cwd = options.cwd ?? process.cwd();
  let code = 0;
  const repeated = repeatedOption(argv);
  if (repeated !== null) {
    io.stderr(`error: option '${repeated}' may only be specified once\n`);
    return 2;
  }
  const program = new Command()
    .name("test-evidence-catalog")
    .description("Validate, query, and stage Case test evidence.")
    .option("--root <path>")
    .option("--json")
    .configureOutput({ writeOut: io.stdout, writeErr: io.stderr })
    .exitOverride();
  const root = (command: Command) =>
    path.resolve(cwd, command.optsWithGlobals<{ root?: string }>().root ?? ".");
  const json = (command: Command) =>
    command.optsWithGlobals<{ json?: boolean }>().json ?? false;
  const output = (command: Command, value: unknown, success: boolean) => {
    io.stdout(
      json(command)
        ? `${JSON.stringify(value, null, 2)}\n`
        : `${success ? "ok" : "failed"}\n`
    );
    code = success ? 0 : 1;
  };
  program.command("check").action(async function (this: Command) {
    const result = await validateTestEvidence({ workspaceRoot: root(this) });
    output(this, result, result.diagnostics.length === 0);
  });
  const refs = program
    .command("check-refs")
    .requiredOption("--snapshot <file>")
    .requiredOption("--expect-project <id>")
    .requiredOption("--expect-scope <id>")
    .requiredOption("--expect-revision <value>")
    .option("--case <id>", "select Case", collect, [] as string[]);
  refs.action(async function (this: Command) {
    const o = this.opts();
    validateCaseIds(o.case);
    const loaded = await readSnapshotFile(path.resolve(root(this), o.snapshot));
    if (loaded === null) {
      const result = await validateTestEvidenceReferences({
        workspaceRoot: root(this),
        snapshot: null,
        expectedSource: {
          projectId: o.expectProject,
          scopeId: o.expectScope,
          revision: o.expectRevision
        },
        ...(o.case.length === 0 ? {} : { caseIds: o.case })
      });
      output(this, result, false);
      return;
    }
    const result = await validateTestEvidenceReferences({
      workspaceRoot: root(this),
      snapshot: loaded,
      expectedSource: {
        projectId: o.expectProject,
        scopeId: o.expectScope,
        revision: o.expectRevision
      },
      ...(o.case.length === 0 ? {} : { caseIds: o.case })
    });
    output(this, result, result.status === "ok");
  });
  const list = program
    .command("list")
    .option("--id <id>")
    .option("--tag <tag>", "AND filter", collect, [] as string[])
    .option("--test <id>")
    .addOption(
      new Option("--limit <number>")
        .argParser(positive)
        .default(testEvidenceQueryDefaultLimit)
    )
    .addOption(
      new Option("--offset <number>").argParser(nonnegative).default(0)
    );
  list.action(async function (this: Command) {
    const o = this.opts();
    validateOptional(testEvidenceCaseIdSchema, o.id, "--id");
    validateValues(testEvidenceTagSchema, o.tag, "--tag");
    validateOptional(testEvidenceTestIdSchema, o.test, "--test");
    const result = await queryTestEvidence({
      workspaceRoot: root(this),
      caseId: o.id,
      tags: o.tag,
      testId: o.test,
      limit: o.limit,
      offset: o.offset
    });
    output(this, result, result.diagnostics.length === 0);
  });
  program.command("tags").action(async function (this: Command) {
    const result = await listTestEvidenceTags({ workspaceRoot: root(this) });
    output(this, result, result.diagnostics.length === 0);
  });
  program.command("show <case-id>").action(async function (
    this: Command,
    caseId: string
  ) {
    validateCaseIds([caseId]);
    const result = await showTestEvidenceCase({
      workspaceRoot: root(this),
      caseId
    });
    output(this, result, result.case !== null);
  });
  const search = program
    .command("search <text>")
    .option("--match <mode>", "all, any, or phrase", "all")
    .option("--tag <tag>", "AND filter", collect, [] as string[])
    .option("--test <id>")
    .addOption(
      new Option("--limit <number>")
        .argParser(positive)
        .default(testEvidenceQueryDefaultLimit)
    )
    .addOption(
      new Option("--offset <number>").argParser(nonnegative).default(0)
    );
  search.action(async function (this: Command, text: string) {
    const o = this.opts();
    if (!["all", "any", "phrase"].includes(o.match))
      throw new InvalidArgumentError("--match must be all, any, or phrase");
    validateValues(testEvidenceTagSchema, o.tag, "--tag");
    validateOptional(testEvidenceTestIdSchema, o.test, "--test");
    const result = await searchTestEvidence({
      workspaceRoot: root(this),
      text,
      match: o.match,
      tags: o.tag,
      testId: o.test,
      limit: o.limit,
      offset: o.offset
    });
    output(this, result, result.diagnostics.length === 0);
  });
  const sync = program
    .command("sync-index")
    .option("--write")
    .option("--select <case-id>", "select Case", collect, [] as string[]);
  sync.action(async function (this: Command) {
    const o = this.opts();
    validateCaseIds(o.select);
    const result = await syncTestEvidenceIndex({
      workspaceRoot: root(this),
      mode: o.write ? "write" : "check",
      ...(o.select.length === 0 ? {} : { selectedCaseIds: o.select })
    });
    output(this, result, result.status === "ok");
  });
  program.command("stage-index <case-ids...>").action(async function (
    this: Command,
    ids: string[]
  ) {
    validateCaseIds(ids);
    const result = await stageTestEvidenceIndex({
      workspaceRoot: root(this),
      caseIds: ids
    });
    output(this, result, result.status === "ok");
  });
  try {
    await program.parseAsync(["node", "test-evidence-catalog.mjs", ...argv]);
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      io.stderr(`error: ${error.message}\n`);
      return 2;
    }
    if (error instanceof CommanderError) return error.exitCode === 0 ? 0 : 2;
    io.stderr(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  return code;
}
function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
function positive(value: string): number {
  const parsed = integer(value);
  if (parsed < 1) throw new InvalidArgumentError("must be positive");
  return parsed;
}
function nonnegative(value: string): number {
  const parsed = integer(value);
  if (parsed < 0) throw new InvalidArgumentError("must be non-negative");
  return parsed;
}
function integer(value: string): number {
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)))
    throw new InvalidArgumentError("must be a safe integer");
  return Number(value);
}
function validateOptional(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  value: string | undefined,
  option: string
): void {
  if (value !== undefined && !v.safeParse(schema, value).success)
    throw new InvalidArgumentError(`${option} is invalid`);
}
function validateValues(
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>,
  values: readonly string[],
  option: string
): void {
  if (values.some((value) => !v.safeParse(schema, value).success))
    throw new InvalidArgumentError(`${option} is invalid`);
}
function validateCaseIds(ids: readonly string[]): void {
  if (ids.length === 0) return;
  validateValues(testEvidenceCaseIdSchema, ids, "Case ID");
  if (new Set(ids).size !== ids.length)
    throw new InvalidArgumentError("Case IDs must not repeat");
}
function repeatedOption(argv: readonly string[]): string | null {
  for (const option of [
    "--root",
    "--json",
    "--snapshot",
    "--expect-project",
    "--expect-scope",
    "--expect-revision",
    "--id",
    "--test",
    "--limit",
    "--offset",
    "--match",
    "--write"
  ] as const)
    if (
      argv.filter((value) => value === option || value.startsWith(`${option}=`))
        .length > 1
    )
      return option;
  return null;
}
async function readSnapshotFile(file: string): Promise<unknown> {
  try {
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 64 * 1024 * 1024)
      return null;
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(await fs.readFile(file))
    );
  } catch {
    return null;
  }
}
export {
  listTestEvidenceTags,
  queryTestEvidence,
  searchTestEvidence,
  showTestEvidenceCase,
  stageTestEvidenceIndex,
  syncTestEvidenceIndex,
  validateTestEvidence,
  validateTestEvidenceReferences
};
export { testEvidenceCaseIdSchema };
export * from "./core-schemas.ts";
if (isMainModule(import.meta.url))
  process.exitCode = await runTestEvidenceCatalogCli();
