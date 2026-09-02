import fs from "node:fs/promises";
import path from "node:path";
import { isFileSystemError } from "../../../shared/src/node/filesystem.ts";
import { compareLexicalText } from "./canonicalization.ts";
import {
  createTestEvidenceDiagnostic,
  testEvidenceErrorText
} from "./diagnostics.ts";
import {
  testEntityIndexPath,
  testEvidenceCasesPath,
  testEvidenceCaseFilePatternSource,
  testEvidenceLedgerIndexPath,
  testEvidenceLedgerPath,
  type TestEvidenceDiagnostic
} from "./schemas.ts";
import { decodeLedgerUtf8Text, type LedgerTextSource } from "./text-source.ts";
import {
  identityDiagnostics,
  invalidRequiredFileDiagnostic,
  invalidRequiredFileEncodingDiagnostic,
  requiredFileReadDiagnostic,
  type LedgerFileIdentity
} from "./workspace-diagnostics.ts";

export type LedgerWorkspaceSources = {
  caseSources: LedgerTextSource[];
  diagnostics: TestEvidenceDiagnostic[];
  entitySource: LedgerTextSource | null;
};

const allowedRootMembers = new Set([
  path.posix.basename(testEntityIndexPath),
  path.posix.basename(testEvidenceLedgerIndexPath),
  path.posix.basename(testEvidenceCasesPath)
]);
const caseFilePattern = new RegExp(testEvidenceCaseFilePatternSource, "u");

export async function readLedgerWorkspaceSources(
  workspaceRoot: string
): Promise<LedgerWorkspaceSources> {
  const root = path.resolve(workspaceRoot);
  const ledgerDirectory = resolveWorkspacePath(root, testEvidenceLedgerPath);
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const identities: LedgerFileIdentity[] = [];

  const rootRead = await readLedgerRootEntries(ledgerDirectory);
  if (rootRead.entries === null) {
    return invalidWorkspaceResult(rootRead.diagnostic);
  }
  const rootEntries = rootRead.entries;

  diagnostics.push(...unsupportedRootMemberDiagnostics(rootEntries));

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

  const caseSources = rootEntries.includes(
    path.posix.basename(testEvidenceCasesPath)
  )
    ? await readCaseSources({
        diagnostics,
        identities,
        workspaceRoot: root
      })
    : [];

  diagnostics.push(...identityDiagnostics(identities));
  return { caseSources, diagnostics, entitySource };
}

async function readLedgerRootEntries(
  ledgerDirectory: string
): Promise<
  | { diagnostic: null; entries: string[] }
  | { diagnostic: TestEvidenceDiagnostic; entries: null }
> {
  try {
    const rootStats = await fs.lstat(ledgerDirectory);
    if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
      return {
        diagnostic: createTestEvidenceDiagnostic({
          category: "case",
          code: "case.ledger-root-invalid",
          message: `${testEvidenceLedgerPath} must be a regular directory, not a symbolic link`,
          path: testEvidenceLedgerPath,
          severity: "error"
        }),
        entries: null
      };
    }
    const entries = await fs.readdir(ledgerDirectory);
    entries.sort(compareLexicalText);
    return { diagnostic: null, entries };
  } catch (error) {
    const missing = isFileSystemError(error, "ENOENT");
    return {
      diagnostic: createTestEvidenceDiagnostic({
        category: missing ? "entity-index" : "case",
        code: missing ? "entity-index.missing" : "case.ledger-root-read-failed",
        message: missing
          ? `${testEntityIndexPath} does not exist`
          : `${testEvidenceLedgerPath} could not be read: ${testEvidenceErrorText(error)}`,
        path: missing ? testEntityIndexPath : testEvidenceLedgerPath,
        severity: "error"
      }),
      entries: null
    };
  }
}

function unsupportedRootMemberDiagnostics(
  rootEntries: readonly string[]
): TestEvidenceDiagnostic[] {
  return rootEntries
    .filter((member) => !allowedRootMembers.has(member))
    .map((member) =>
      createTestEvidenceDiagnostic({
        category: "case",
        code: "case.root-member-unsupported",
        message: `${testEvidenceLedgerPath}/${member} is not part of the fixed ledger layout`,
        path: `${testEvidenceLedgerPath}/${member}`,
        severity: "error"
      })
    );
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
      options.diagnostics.push(
        createTestEvidenceDiagnostic({
          category: "index",
          code: "index.path-invalid",
          message: `${testEvidenceLedgerIndexPath} must be a regular file when it exists`,
          path: testEvidenceLedgerIndexPath,
          severity: "error"
        })
      );
      return;
    }
    options.identities.push(fileIdentity(testEvidenceLedgerIndexPath, stats));
  } catch (error) {
    options.diagnostics.push(
      createTestEvidenceDiagnostic({
        category: "index",
        code: "index.path-read-failed",
        message: `${testEvidenceLedgerIndexPath} could not be inspected: ${testEvidenceErrorText(error)}`,
        path: testEvidenceLedgerIndexPath,
        severity: "error"
      })
    );
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
  const directoryRead = await readCaseDirectoryMembers(casesDirectory);
  if (directoryRead.members === null) {
    options.diagnostics.push(directoryRead.diagnostic);
    return [];
  }

  const sources: LedgerTextSource[] = [];
  for (const member of directoryRead.members) {
    const relativePath = `${testEvidenceCasesPath}/${member}`;
    if (!caseFilePattern.test(member)) {
      options.diagnostics.push(
        createTestEvidenceDiagnostic({
          category: "case",
          code: "case.member-unsupported",
          message: `${relativePath} must be a direct kebab-case Markdown Case file`,
          path: relativePath,
          severity: "error"
        })
      );
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

async function readCaseDirectoryMembers(
  casesDirectory: string
): Promise<
  | { diagnostic: null; members: string[] }
  | { diagnostic: TestEvidenceDiagnostic; members: null }
> {
  try {
    const stats = await fs.lstat(casesDirectory);
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      return {
        diagnostic: createTestEvidenceDiagnostic({
          category: "case",
          code: "case.directory-invalid",
          message: `${testEvidenceCasesPath} must be a regular directory, not a symbolic link`,
          path: testEvidenceCasesPath,
          severity: "error"
        }),
        members: null
      };
    }
    const members = await fs.readdir(casesDirectory);
    members.sort(compareLexicalText);
    return { diagnostic: null, members };
  } catch (error) {
    return {
      diagnostic: createTestEvidenceDiagnostic({
        category: "case",
        code: "case.directory-read-failed",
        message: `${testEvidenceCasesPath} could not be read: ${testEvidenceErrorText(error)}`,
        path: testEvidenceCasesPath,
        severity: "error"
      }),
      members: null
    };
  }
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
      options.diagnostics.push(invalidRequiredFileDiagnostic(options));
      return null;
    }
    options.identities.push(fileIdentity(options.relativePath, stats));
    const data = await fs.readFile(absolutePath);
    let text: string;
    try {
      text = decodeLedgerUtf8Text(data);
    } catch {
      options.diagnostics.push(invalidRequiredFileEncodingDiagnostic(options));
      return null;
    }
    return { path: options.relativePath, text };
  } catch (error) {
    options.diagnostics.push(requiredFileReadDiagnostic(options, error));
    return null;
  }
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
