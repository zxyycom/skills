import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import type {
  TestEntity,
  TestEvidenceLedgerCase
} from "../src/ledger/index.ts";
import { runTestEvidenceLedgerCli } from "../src/ledger/cli.ts";

const execFileAsync = promisify(execFile);

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  ".."
);

const ledgerCliHarness = path.join(
  repositoryRoot,
  "tools",
  "test-evidence",
  "tests",
  "ledger-cli-harness.ts"
);

export const manyToManyEntities: TestEntity[] = [
  {
    id: "test.alpha",
    name: "Alpha behavior",
    locators: ["tests/alpha.test.ts > alpha behavior"]
  },
  {
    id: "test.beta",
    name: "Beta behavior",
    locators: ["tests/beta.test.ts > beta behavior"]
  },
  {
    id: "test.gamma",
    name: "Gamma behavior",
    locators: ["tests/gamma.test.ts > gamma behavior"]
  }
];

export const manyToManyCases: TestEvidenceLedgerCase[] = [
  {
    id: "LEDGER-ALPHA-BETA-001",
    title: "Alpha and beta establish a shared result",
    sourcePath: "cases/alpha-beta.md",
    testIds: ["test.alpha", "test.beta"],
    tags: ["shared"],
    contract: ["Alpha and beta jointly support one semantic conclusion."],
    proves: ["The shared alpha-beta result is observable."]
  },
  {
    id: "LEDGER-ALPHA-GAMMA-001",
    title: "Alpha and gamma establish a mutation result",
    sourcePath: "cases/alpha-gamma.md",
    testIds: ["test.alpha", "test.gamma"],
    tags: ["mutation"],
    contract: ["Alpha and gamma jointly support the mutation conclusion."],
    proves: ["The alpha-gamma mutation result is observable."]
  },
  {
    id: "LEDGER-BETA-GAMMA-001",
    title: "Beta and gamma establish another shared result",
    sourcePath: "cases/beta-gamma.md",
    testIds: ["test.beta", "test.gamma"],
    tags: ["shared"],
    contract: ["Beta and gamma jointly support another conclusion."],
    proves: ["The beta-gamma shared result is observable."]
  }
];

export async function withLedgerWorkspace(
  operation: (workspaceRoot: string) => Promise<void>,
  fixture: "empty" | "many-to-many" = "many-to-many"
): Promise<void> {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "test-evidence-ledger-")
  );
  try {
    if (fixture === "empty") {
      await writeLedgerFixture(workspaceRoot, {
        cases: [],
        entities: [],
        sourceRevision: "empty-v1"
      });
    } else {
      await writeLedgerFixture(workspaceRoot, {
        cases: manyToManyCases,
        entities: manyToManyEntities,
        sourceRevision: "many-to-many-v1"
      });
    }
    await operation(workspaceRoot);
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
}

export async function writeLedgerFixture(
  workspaceRoot: string,
  fixture: {
    cases: readonly TestEvidenceLedgerCase[];
    entities: readonly TestEntity[];
    sourceRevision: string;
  }
): Promise<void> {
  await writeWorkspaceFile(
    workspaceRoot,
    "docs/test-evidence/test-entity-index.json",
    entityIndexText(fixture.entities, fixture.sourceRevision)
  );
  if (fixture.cases.length > 0) {
    for (const ledgerCase of fixture.cases) {
      await writeWorkspaceFile(
        workspaceRoot,
        `docs/test-evidence/${ledgerCase.sourcePath}`,
        caseMarkdown(ledgerCase)
      );
    }
  }
}

export function entityIndexText(
  entities: readonly TestEntity[],
  sourceRevision = "fixture-v1"
): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      sourceRevision,
      entities
    },
    null,
    2
  )}\n`;
}

export function caseMarkdown(
  ledgerCase: TestEvidenceLedgerCase,
  lineEnding = "\n"
): string {
  const lines = [
    `### Case ${ledgerCase.id}: ${ledgerCase.title}`,
    "",
    "Tests:",
    ...ledgerCase.testIds.map((testId) => `- \`${testId}\``),
    "",
    ...(ledgerCase.tags.length === 0
      ? []
      : ["Tags:", ...ledgerCase.tags.map((tag) => `- \`${tag}\``), ""]),
    "Contract:",
    ...ledgerCase.contract.map((entry) => `- ${entry}`),
    "",
    "Proves:",
    ...ledgerCase.proves.map((entry) => `- ${entry}`),
    ""
  ];
  return lines.join(lineEnding);
}

export async function writeWorkspaceFile(
  workspaceRoot: string,
  relativePath: string,
  content: string
): Promise<void> {
  const targetPath = path.join(workspaceRoot, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, "utf8");
}

export async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
}

export async function runLedgerCli(
  args: readonly string[],
  options: Readonly<{ cwd?: string }> = {}
): Promise<{
  code: number;
  stderr: string;
  stdout: string;
}> {
  const stderr: string[] = [];
  const stdout: string[] = [];
  const code = await runTestEvidenceLedgerCli(args, {
    cwd: options.cwd,
    io: {
      stderr: (text) => stderr.push(text),
      stdout: (text) => stdout.push(text)
    }
  });
  return {
    code,
    stderr: stderr.join(""),
    stdout: stdout.join("")
  };
}

export async function runLedgerCliSmoke(args: readonly string[]): Promise<{
  code: number;
  stderr: string;
  stdout: string;
}> {
  try {
    const result = await execFileAsync(
      process.execPath,
      [ledgerCliHarness, ...args],
      {
        cwd: repositoryRoot,
        encoding: "utf8"
      }
    );
    return { code: 0, stderr: result.stderr, stdout: result.stdout };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "stdout" in error &&
      "stderr" in error &&
      "code" in error &&
      typeof error.code === "number"
    ) {
      return {
        code: error.code,
        stdout: String(error.stdout),
        stderr: String(error.stderr)
      };
    }
    throw error;
  }
}

export function ledgerIndexPath(workspaceRoot: string): string {
  return path.join(
    workspaceRoot,
    "docs",
    "test-evidence",
    "test-evidence-index.json"
  );
}

export function entityIndexPath(workspaceRoot: string): string {
  return path.join(
    workspaceRoot,
    "docs",
    "test-evidence",
    "test-entity-index.json"
  );
}

export function casesPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "docs", "test-evidence", "cases");
}
