import fs from "node:fs/promises";
import path from "node:path";
import type { ExpectedSource, MigrationPlan } from "./migrate-types.ts";
import { MigrationError } from "./migrate-types.ts";

export type MigrationCliInput = Readonly<{
  expectedSource: ExpectedSource;
  snapshot: unknown;
  workspaceRoot: string;
  write: boolean;
}>;

type ParsedArguments = {
  project: string | null;
  revision: string | null;
  root: string;
  scope: string | null;
  snapshot: string | null;
  write: boolean;
};

type ValueOption =
  | "--snapshot"
  | "--expect-project"
  | "--expect-scope"
  | "--expect-revision"
  | "--root";

export async function readMigrationCliInput(
  argv: readonly string[]
): Promise<MigrationCliInput> {
  const parsed = parseArgs(argv);
  const raw = await fs.readFile(
    path.resolve(parsed.root, parsed.snapshot),
    "utf8"
  );
  return {
    expectedSource: {
      projectId: parsed.project,
      revision: parsed.revision,
      scopeId: parsed.scope
    },
    snapshot: JSON.parse(raw) as unknown,
    workspaceRoot: parsed.root,
    write: parsed.write
  };
}

export function printMigrationResult(
  result: MigrationPlan,
  write: boolean
): void {
  process.stdout.write(
    `${JSON.stringify({ ...result, mode: write ? "write" : "dry-run" }, null, 2)}\n`
  );
}

function parseArgs(argv: readonly string[]): {
  project: string;
  revision: string;
  root: string;
  scope: string;
  snapshot: string;
  write: boolean;
} {
  const parsed: ParsedArguments = {
    project: null,
    revision: null,
    root: process.cwd(),
    scope: null,
    snapshot: null,
    write: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write") {
      if (parsed.write) throw new MigrationError("--write may appear once");
      parsed.write = true;
      continue;
    }
    if (!isValueOption(argument)) {
      throw new MigrationError(`unknown argument: ${argument}`);
    }
    const value = argv[++index];
    if (value === undefined || value.startsWith("--")) {
      throw new MigrationError(`${argument} requires a value`);
    }
    assignValueArgument(parsed, argument, value);
  }
  if (
    parsed.snapshot === null ||
    parsed.project === null ||
    parsed.scope === null ||
    parsed.revision === null
  ) {
    throw new MigrationError(
      "--snapshot, --expect-project, --expect-scope, and --expect-revision are required"
    );
  }
  return {
    project: parsed.project,
    revision: parsed.revision,
    root: parsed.root,
    scope: parsed.scope,
    snapshot: parsed.snapshot,
    write: parsed.write
  };
}

function assignValueArgument(
  parsed: ParsedArguments,
  argument: ValueOption,
  value: string
): void {
  if (argument === "--root") {
    parsed.root = path.resolve(value);
    return;
  }
  const field = {
    "--expect-project": "project",
    "--expect-revision": "revision",
    "--expect-scope": "scope",
    "--snapshot": "snapshot"
  }[argument] as "project" | "revision" | "scope" | "snapshot";
  if (parsed[field] !== null) {
    throw new MigrationError(`${argument} may appear once`);
  }
  parsed[field] = value;
}

function isValueOption(value: string | undefined): value is ValueOption {
  return (
    value === "--snapshot" ||
    value === "--expect-project" ||
    value === "--expect-scope" ||
    value === "--expect-revision" ||
    value === "--root"
  );
}
