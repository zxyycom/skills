import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../../shared/src/node/filesystem.ts";
import { createTestEvidenceDiagnostic } from "./diagnostics.ts";
import {
  testEntityIndexPath,
  testEvidenceCasesPath,
  testEvidenceCaseFilePatternSource,
  testEvidenceLedgerIndexPath,
  testEvidenceLedgerPath,
  type TestEvidenceDiagnostic
} from "./schemas.ts";

export type LedgerTextSource = {
  path: string;
  text: string;
};

export type LedgerWorkspaceSources = {
  caseSources: LedgerTextSource[];
  diagnostics: TestEvidenceDiagnostic[];
  entitySource: LedgerTextSource | null;
};

type LedgerFileIdentity = {
  device: bigint;
  inode: bigint;
  path: string;
};

const allowedRootMembers = new Set([
  path.posix.basename(testEntityIndexPath),
  path.posix.basename(testEvidenceLedgerIndexPath),
  path.posix.basename(testEvidenceCasesPath)
]);
const caseFilePattern = new RegExp(
  testEvidenceCaseFilePatternSource,
  "u"
);

export async function readLedgerWorkspaceSources(
  workspaceRoot: string
): Promise<LedgerWorkspaceSources> {
  const root = path.resolve(workspaceRoot);
  const ledgerDirectory = resolveWorkspacePath(root, testEvidenceLedgerPath);
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const identities: LedgerFileIdentity[] = [];

  let rootEntries: string[];
  try {
    const rootStats = await fs.lstat(ledgerDirectory);
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
      return invalidWorkspaceResult(createTestEvidenceDiagnostic({
        category: "case",
        code: "case.ledger-root-invalid",
        message: `${testEvidenceLedgerPath} must be a regular directory, not a symbolic link`,
        path: testEvidenceLedgerPath,
        severity: "error"
      }));
    }
    rootEntries = await fs.readdir(ledgerDirectory);
    rootEntries.sort(compareText);
  } catch (error) {
    if (isFileSystemError(error, "ENOENT")) {
      return invalidWorkspaceResult(createTestEvidenceDiagnostic({
        category: "entity-index",
        code: "entity-index.missing",
        message: `${testEntityIndexPath} does not exist`,
        path: testEntityIndexPath,
        severity: "error"
      }));
    }
    return invalidWorkspaceResult(createTestEvidenceDiagnostic({
      category: "case",
      code: "case.ledger-root-read-failed",
      message: `${testEvidenceLedgerPath} could not be read: ${errorText(error)}`,
      path: testEvidenceLedgerPath,
      severity: "error"
    }));
  }

  for (const member of rootEntries) {
    if (!allowedRootMembers.has(member)) {
      diagnostics.push(createTestEvidenceDiagnostic({
        category: "case",
        code: "case.root-member-unsupported",
        message: `${testEvidenceLedgerPath}/${member} is not part of the fixed ledger layout`,
        path: `${testEvidenceLedgerPath}/${member}`,
        severity: "error"
      }));
    }
  }

  const entitySource = await readRequiredRegularFile({
    category: "entity-index",
    codePrefix: "entity-index",
    diagnostics,
    identities,
    relativePath: testEntityIndexPath,
    workspaceRoot: root
  });

  if (rootEntries.includes(path.posix.basename(testEvidenceLedgerIndexPath))) {
    await inspectOptionalIndex({
      diagnostics,
      identities,
      workspaceRoot: root
    });
  }

  const caseSources = rootEntries.includes(path.posix.basename(testEvidenceCasesPath))
    ? await readCaseSources({
      diagnostics,
      identities,
      workspaceRoot: root
    })
    : [];

  diagnostics.push(...identityDiagnostics(identities));
  return { caseSources, diagnostics, entitySource };
}

async function inspectOptionalIndex(options: {
  diagnostics: TestEvidenceDiagnostic[];
  identities: LedgerFileIdentity[];
  workspaceRoot: string;
}): Promise<void> {
  const absolutePath = resolveWorkspacePath(
    options.workspaceRoot,
    testEvidenceLedgerIndexPath
  );
  try {
    const stats = await fs.lstat(absolutePath, { bigint: true });
    if (stats.isSymbolicLink() || !stats.isFile()) {
      options.diagnostics.push(createTestEvidenceDiagnostic({
        category: "index",
        code: "index.path-invalid",
        message: `${testEvidenceLedgerIndexPath} must be a regular file when it exists`,
        path: testEvidenceLedgerIndexPath,
        severity: "error"
      }));
      return;
    }
    options.identities.push(fileIdentity(testEvidenceLedgerIndexPath, stats));
  } catch (error) {
    options.diagnostics.push(createTestEvidenceDiagnostic({
      category: "index",
      code: "index.path-read-failed",
      message: `${testEvidenceLedgerIndexPath} could not be inspected: ${errorText(error)}`,
      path: testEvidenceLedgerIndexPath,
      severity: "error"
    }));
  }
}

async function readCaseSources(options: {
  diagnostics: TestEvidenceDiagnostic[];
  identities: LedgerFileIdentity[];
  workspaceRoot: string;
}): Promise<LedgerTextSource[]> {
  const casesDirectory = resolveWorkspacePath(
    options.workspaceRoot,
    testEvidenceCasesPath
  );
  let members: string[];
  try {
    const stats = await fs.lstat(casesDirectory);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      options.diagnostics.push(createTestEvidenceDiagnostic({
        category: "case",
        code: "case.directory-invalid",
        message: `${testEvidenceCasesPath} must be a regular directory, not a symbolic link`,
        path: testEvidenceCasesPath,
        severity: "error"
      }));
      return [];
    }
    members = await fs.readdir(casesDirectory);
    members.sort(compareText);
  } catch (error) {
    options.diagnostics.push(createTestEvidenceDiagnostic({
      category: "case",
      code: "case.directory-read-failed",
      message: `${testEvidenceCasesPath} could not be read: ${errorText(error)}`,
      path: testEvidenceCasesPath,
      severity: "error"
    }));
    return [];
  }

  const sources: LedgerTextSource[] = [];
  for (const member of members) {
    const relativePath = `${testEvidenceCasesPath}/${member}`;
    if (!caseFilePattern.test(member)) {
      options.diagnostics.push(createTestEvidenceDiagnostic({
        category: "case",
        code: "case.member-unsupported",
        message: `${relativePath} must be a direct kebab-case Markdown Case file`,
        path: relativePath,
        severity: "error"
      }));
      continue;
    }
    const source = await readRequiredRegularFile({
      category: "case",
      codePrefix: "case",
      diagnostics: options.diagnostics,
      identities: options.identities,
      relativePath,
      workspaceRoot: options.workspaceRoot
    });
    if (source !== null) {
      sources.push({
        path: `cases/${member}`,
        text: source.text
      });
    }
  }
  return sources;
}

async function readRequiredRegularFile(options: {
  category: "entity-index" | "case";
  codePrefix: "entity-index" | "case";
  diagnostics: TestEvidenceDiagnostic[];
  identities: LedgerFileIdentity[];
  relativePath: string;
  workspaceRoot: string;
}): Promise<LedgerTextSource | null> {
  const absolutePath = resolveWorkspacePath(
    options.workspaceRoot,
    options.relativePath
  );
  try {
    const stats = await fs.lstat(absolutePath, { bigint: true });
    if (stats.isSymbolicLink() || !stats.isFile()) {
      options.diagnostics.push(createTestEvidenceDiagnostic({
        category: options.category,
        code: `${options.codePrefix}.path-invalid`,
        message: `${options.relativePath} must be a regular file, not a symbolic link`,
        path: options.relativePath,
        severity: "error"
      }));
      return null;
    }
    options.identities.push(fileIdentity(options.relativePath, stats));
    const data = await fs.readFile(absolutePath);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    } catch {
      options.diagnostics.push(createTestEvidenceDiagnostic({
        category: options.category,
        code: `${options.codePrefix}.encoding-invalid`,
        message: `${options.relativePath} must contain valid UTF-8 text`,
        path: options.relativePath,
        severity: "error"
      }));
      return null;
    }
    return { path: options.relativePath, text };
  } catch (error) {
    const missing = isFileSystemError(error, "ENOENT");
    options.diagnostics.push(createTestEvidenceDiagnostic({
      category: options.category,
      code: missing
        ? `${options.codePrefix}.missing`
        : `${options.codePrefix}.read-failed`,
      message: missing
        ? `${options.relativePath} does not exist`
        : `${options.relativePath} could not be read: ${errorText(error)}`,
      path: options.relativePath,
      severity: "error"
    }));
    return null;
  }
}

function identityDiagnostics(
  identities: readonly LedgerFileIdentity[]
): TestEvidenceDiagnostic[] {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  for (let leftIndex = 0; leftIndex < identities.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < identities.length;
      rightIndex += 1
    ) {
      const left = identities[leftIndex]!;
      const right = identities[rightIndex]!;
      if (left.device !== right.device || left.inode !== right.inode) {
        continue;
      }
      const indexInvolved = left.path === testEvidenceLedgerIndexPath
        || right.path === testEvidenceLedgerIndexPath;
      const entityInvolved = left.path === testEntityIndexPath
        || right.path === testEntityIndexPath;
      diagnostics.push(createTestEvidenceDiagnostic({
        category: indexInvolved
          ? "index"
          : entityInvolved ? "entity-index" : "case",
        code: indexInvolved
          ? "index.identity-conflict"
          : entityInvolved
            ? "entity-index.identity-conflict"
            : "case.identity-conflict",
        message: `${left.path} and ${right.path} must have distinct file-system identities`,
        path: right.path,
        severity: "error"
      }));
    }
  }
  return diagnostics;
}

function fileIdentity(
  relativePath: string,
  stats: Awaited<ReturnType<typeof fs.lstat>> & {
    dev: bigint;
    ino: bigint;
  }
): LedgerFileIdentity {
  return {
    device: stats.dev,
    inode: stats.ino,
    path: relativePath
  };
}

function invalidWorkspaceResult(
  diagnostic: TestEvidenceDiagnostic
): LedgerWorkspaceSources {
  return {
    caseSources: [],
    diagnostics: [diagnostic],
    entitySource: null
  };
}

function resolveWorkspacePath(
  workspaceRoot: string,
  relativePath: string
): string {
  return path.join(workspaceRoot, ...relativePath.split("/"));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
