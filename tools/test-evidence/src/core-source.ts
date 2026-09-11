import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { normalizeCaseMarkdown, parseCaseSource } from "./case-source.ts";
import {
  testEvidenceCaseSchema,
  testEvidenceCasesPath,
  testEvidenceIndexPath,
  testEvidencePath,
  type TestEvidenceCase,
  type TestEvidenceDiagnostic
} from "./core-schemas.ts";
import { diagnostic, fingerprint, sourcePath } from "./core-support.ts";
import type { StateSourceRevision } from "../../index-runtime/src/index.ts";

export type ParsedCase = Readonly<{
  case: TestEvidenceCase;
  fingerprint: string;
  markdown: string;
}>;
export type Source = Readonly<{
  cases: readonly ParsedCase[];
  diagnostics: readonly TestEvidenceDiagnostic[];
  revision: StateSourceRevision | null;
}>;
const caseMemberPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;

export async function readCases(workspaceRoot: string): Promise<Source> {
  const root = path.resolve(workspaceRoot);
  const evidenceRoot = path.join(root, ...testEvidencePath.split("/"));
  const casesRoot = path.join(root, ...testEvidenceCasesPath.split("/"));
  const evidence = await inspectEvidenceRoot(evidenceRoot);
  if (evidence === null) return uninitializedRoot();
  const diagnostics = unsupportedRootMembers(evidence);
  const members = await inspectCaseDirectory(casesRoot, diagnostics);
  if (members === null) return { cases: [], diagnostics, revision: null };
  const parsed = await Promise.all(
    members.sort().map((member) => readCaseMember(casesRoot, member))
  );
  const cases: ParsedCase[] = [];
  const ids = new Map<string, string>();
  const identities = new Map<string, string>();
  for (const entry of parsed)
    addParsedMember(entry, cases, ids, identities, diagnostics);
  cases.sort((left, right) => left.case.id.localeCompare(right.case.id));
  return {
    cases,
    diagnostics,
    revision: diagnostics.length === 0 ? sourceRevision(cases) : null
  };
}

type ParsedMember = Readonly<{
  diagnostics: readonly TestEvidenceDiagnostic[];
  identity: string | null;
  relative: string;
  value: ParsedCase | null;
}>;

async function inspectEvidenceRoot(
  evidenceRoot: string
): Promise<string[] | null> {
  try {
    const stat = await fs.lstat(evidenceRoot);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error("invalid");
    return await fs.readdir(evidenceRoot);
  } catch {
    return null;
  }
}
function uninitializedRoot(): Source {
  return {
    cases: [],
    diagnostics: [
      diagnostic(
        "case",
        "case.root-uninitialized",
        `${testEvidencePath} must be an existing regular directory`,
        { path: testEvidencePath }
      )
    ],
    revision: null
  };
}
function unsupportedRootMembers(
  rootEntries: readonly string[]
): TestEvidenceDiagnostic[] {
  return rootEntries
    .filter(
      (member) =>
        member !== "cases" &&
        member !== path.posix.basename(testEvidenceIndexPath)
    )
    .map((member) =>
      diagnostic(
        "case",
        "case.root-member-unsupported",
        `${testEvidencePath}/${member} is not part of the Case layout`,
        { path: `${testEvidencePath}/${member}` }
      )
    );
}
async function inspectCaseDirectory(
  casesRoot: string,
  diagnostics: TestEvidenceDiagnostic[]
): Promise<string[] | null> {
  try {
    const stat = await fs.lstat(casesRoot);
    if (stat.isSymbolicLink() || !stat.isDirectory())
      throw new Error("invalid");
    return await fs.readdir(casesRoot);
  } catch {
    diagnostics.push(
      diagnostic(
        "case",
        "case.directory-uninitialized",
        `${testEvidenceCasesPath} must be an existing regular directory`,
        { path: testEvidenceCasesPath }
      )
    );
    return null;
  }
}
async function readCaseMember(
  casesRoot: string,
  member: string
): Promise<ParsedMember> {
  const relative = sourcePath(member);
  if (!caseMemberPattern.test(member)) return unsupportedCaseMember(relative);
  try {
    return await readRegularCaseMember(casesRoot, member, relative);
  } catch {
    return unreadableCaseMember(relative);
  }
}
function unsupportedCaseMember(relative: string): ParsedMember {
  return memberFailure(
    relative,
    "case.member-unsupported",
    `${relative} must be a direct kebab-case Markdown Case file`
  );
}
function unreadableCaseMember(relative: string): ParsedMember {
  return memberFailure(
    relative,
    "case.read-failed",
    `${relative} must be a regular UTF-8 file`
  );
}
function memberFailure(
  relative: string,
  code: string,
  message: string
): ParsedMember {
  return {
    diagnostics: [diagnostic("case", code, message, { path: relative })],
    identity: null,
    relative,
    value: null
  };
}
async function readRegularCaseMember(
  casesRoot: string,
  member: string,
  relative: string
): Promise<ParsedMember> {
  const absolute = path.join(casesRoot, member);
  const stat = await fs.lstat(absolute);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error("invalid");
  const markdown = new TextDecoder("utf-8", { fatal: true }).decode(
    await fs.readFile(absolute)
  );
  return parsedCaseMember(relative, markdown, `${stat.dev}:${stat.ino}`);
}
function parsedCaseMember(
  relative: string,
  markdown: string,
  identity: string
): ParsedMember {
  const parsed = parseCaseSource({ path: relative, text: markdown });
  if (parsed.value === null)
    return {
      diagnostics: parsed.diagnostics.map(toBlockingDiagnostic),
      identity,
      relative,
      value: null
    };
  const checked = v.safeParse(testEvidenceCaseSchema, parsed.value.case);
  if (!checked.success)
    return memberFailureWithIdentity(
      relative,
      identity,
      "case.schema-invalid",
      `${relative} is invalid`
    );
  const normalized = normalizeCaseMarkdown(markdown);
  return {
    diagnostics: [],
    identity,
    relative,
    value: {
      case: checked.output,
      fingerprint: fingerprint(JSON.stringify([relative, normalized])),
      markdown: normalized
    }
  };
}
function memberFailureWithIdentity(
  relative: string,
  identity: string,
  code: string,
  message: string
): ParsedMember {
  return {
    diagnostics: [diagnostic("case", code, message, { path: relative })],
    identity,
    relative,
    value: null
  };
}
function toBlockingDiagnostic(
  entry: TestEvidenceDiagnostic
): TestEvidenceDiagnostic {
  return diagnostic(entry.category, entry.code, entry.message, {
    caseId: entry.caseId,
    path: entry.path,
    testId: entry.testId
  });
}
function addParsedMember(
  entry: ParsedMember,
  cases: ParsedCase[],
  ids: Map<string, string>,
  identities: Map<string, string>,
  diagnostics: TestEvidenceDiagnostic[]
): void {
  diagnostics.push(...entry.diagnostics);
  if (entry.identity !== null) {
    const firstPath = identities.get(entry.identity);
    if (firstPath !== undefined) {
      diagnostics.push(
        diagnostic(
          "case",
          "case.identity-conflict",
          `${firstPath} and ${entry.relative} must have distinct file-system identities`,
          { path: entry.relative }
        )
      );
      return;
    }
    identities.set(entry.identity, entry.relative);
  }
  if (entry.value === null) return;
  const firstPath = ids.get(entry.value.case.id);
  if (firstPath !== undefined) {
    diagnostics.push(
      diagnostic(
        "case",
        "case.id-duplicate",
        `${entry.value.case.id} appears in both ${firstPath} and ${entry.relative}`,
        { caseId: entry.value.case.id, path: entry.relative }
      )
    );
    return;
  }
  ids.set(entry.value.case.id, entry.relative);
  cases.push(entry.value);
}
function sourceRevision(cases: readonly ParsedCase[]): StateSourceRevision {
  return {
    metadata: fingerprint("{}"),
    entries: Object.fromEntries(
      cases.map((entry) => [entry.case.id, entry.fingerprint])
    )
  };
}

export async function readSingleCase(
  workspaceRoot: string,
  relative: string
): Promise<{
  diagnostics: readonly TestEvidenceDiagnostic[];
  value: ParsedCase | null;
}> {
  if (!/^cases\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u.test(relative))
    return {
      diagnostics: [
        diagnostic(
          "case",
          "case.source-path-invalid",
          `${relative} is not a Case source path`,
          { path: relative }
        )
      ],
      value: null
    };
  const result = await readCaseMember(
    path.join(
      path.resolve(workspaceRoot),
      ...testEvidencePath.split("/"),
      "cases"
    ),
    path.basename(relative)
  );
  return { diagnostics: result.diagnostics, value: result.value };
}
