import fs from "node:fs/promises";
import path from "node:path";
import { err, ok, type Result } from "neverthrow";
import { candidatePathForInvestigationId } from "./candidate-path.ts";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  type InvestigationDiagnostic
} from "./diagnostics.ts";
import {
  inspectInvestigationCollectionLayout,
  readInvestigationSources
} from "./investigation-index-source.ts";
import {
  parseInvestigationReport,
  serializeInvestigationReportFrontmatter
} from "./markdown.ts";
import {
  parseInvestigationCandidateCreateOptions,
  parseInvestigationCandidateListOptions,
  parseInvestigationCandidateShowOptions
} from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  investigationIndexFileName,
  isInvestigationId,
  isInvestigationTag,
  resolveInvestigationsDirectory,
  type ResolvedInvestigationsDirectory
} from "./report-path.ts";
import {
  buildInvestigationReportState,
  isInvestigationRelationType
} from "./report-validation.ts";
import {
  validateCandidateInvestigationResources,
  validateFullInvestigationResources,
  type InvestigationResourceReferencesByReport
} from "./resources.ts";
import { investigationResourcesDirectoryName } from "./resource-reference.ts";
import { investigationTimestampMilliseconds } from "./timestamp.ts";
import { investigationRelationTypes } from "./types.ts";
import type {
  InvestigationCandidate,
  InvestigationCandidateCreateOptions,
  InvestigationCandidateCreateResult,
  InvestigationCandidateListResult,
  InvestigationCandidateShowOptions,
  InvestigationCandidateShowResult,
  InvestigationRelation,
  InvestigationSource
} from "./types.ts";

type PreparedCandidateCreate = Readonly<{
  candidate: InvestigationCandidateCreateOptions;
  resolved: ResolvedInvestigationsDirectory;
}>;

type PreparedCandidateLocation = Readonly<{
  id?: string;
  resolved: ResolvedInvestigationsDirectory;
}>;

export async function createInvestigationCandidate(
  input: unknown
): Promise<InvestigationCandidateCreateResult> {
  const prepared = prepareCandidateCreate(input);
  if (prepared.isErr()) return createFailure("invalid-options", prepared.error);
  try {
    await fs.mkdir(prepared.value.resolved.investigationsDirectory, {
      recursive: true
    });
  } catch (error) {
    return createFailure(
      "error",
      ["investigation candidate directory could not be created"],
      [
        diagnosticFromError({
          code: "investigation-report.candidate-directory-create-failed",
          error,
          reason:
            "the investigation directory required for the candidate could not be created",
          recovery:
            "make the configured investigation directory available and writable, then retry candidate creation",
          target: prepared.value.resolved.investigationsDirectory
        })
      ]
    );
  }
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr()) return createFailure("error", canonical.error);
  try {
    return await withInvestigationCollectionMutationLock(
      path.join(
        canonical.value.investigationsDirectory,
        investigationIndexFileName
      ),
      async () =>
        await createCandidateWithinLock(
          canonical.value.investigationsDirectory,
          prepared.value.candidate
        )
    );
  } catch (error) {
    return createFailure(
      "error",
      ["investigation candidate could not be created"],
      [
        candidateOperationDiagnostic(
          error,
          canonical.value.investigationsDirectory
        )
      ]
    );
  }
}

export async function listInvestigationCandidates(
  input: unknown
): Promise<InvestigationCandidateListResult> {
  const prepared = prepareCandidateLocation(input, false);
  if (prepared.isErr()) return listFailure(prepared.error);
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr()) return listFailure(canonical.error);
  return await listCandidatesFromRoot(canonical.value.investigationsDirectory);
}

export async function showInvestigationCandidate(
  input: unknown
): Promise<InvestigationCandidateShowResult> {
  const prepared = prepareCandidateLocation(input, true);
  if (prepared.isErr()) return showFailure(prepared.error);
  const id = prepared.value.id!;
  if (!isInvestigationId(id)) {
    return showFailure([
      `${id || "<empty>"} show-candidate id must use an Investigation ID`
    ]);
  }
  const canonical = await canonicalizeInvestigationsDirectory(
    prepared.value.resolved
  );
  if (canonical.isErr()) return showFailure(canonical.error);
  const layout = await safeLayout(canonical.value.investigationsDirectory);
  if (layout.status === "error")
    return showFailure(layout.errors, layout.diagnostics);
  if (!layout.value.candidateIds.includes(id)) {
    return showFailure([`${id} investigation candidate does not exist`]);
  }
  const candidate = await readInvestigationCandidate(
    canonical.value.investigationsDirectory,
    id
  );
  return candidate.status === "ok"
    ? {
        candidate: candidate.value,
        diagnostics: [],
        errors: [],
        status: "ok",
        warnings: candidate.value.errors
      }
    : showFailure(candidate.errors, candidate.diagnostics);
}

async function createCandidateWithinLock(
  investigationsDirectory: string,
  candidate: InvestigationCandidateCreateOptions
): Promise<InvestigationCandidateCreateResult> {
  const layout = await safeLayout(investigationsDirectory);
  if (layout.status === "error") {
    return createFailure("error", layout.errors, layout.diagnostics);
  }
  if (layout.value.reportIds.includes(candidate.id)) {
    return createFailure("error", [
      `${candidate.id} already exists as a formal investigation report`
    ]);
  }
  if (layout.value.candidateIds.includes(candidate.id)) {
    return createFailure("error", [
      `${candidate.id} investigation candidate already exists`
    ]);
  }
  const target = candidatePathForInvestigationId(
    investigationsDirectory,
    candidate.id
  );
  const markdown = serializeInvestigationCandidate(candidate);
  const written = await writeCandidateAtomically(target, markdown);
  if (written.isErr()) {
    return createFailure(
      "error",
      [`${candidate.id} investigation candidate was not created`],
      [
        diagnosticFromError({
          code: "investigation-report.candidate-create-failed",
          error: written.error,
          reason: "the investigation candidate could not be atomically created",
          recovery:
            "resolve the reported candidate-path problem, then create the candidate again",
          target
        })
      ]
    );
  }
  const read = await readInvestigationCandidate(
    investigationsDirectory,
    candidate.id
  );
  return createdCandidateResult(
    candidate.id,
    target,
    markdown,
    written.value.warnings,
    read
  );
}

function createdCandidateResult(
  id: string,
  target: string,
  markdown: string,
  writeWarnings: readonly string[],
  read: Awaited<ReturnType<typeof readInvestigationCandidate>>
): InvestigationCandidateCreateResult {
  if (read.status === "error") {
    const unreadableCandidate: InvestigationCandidate = {
      diagnostics: read.diagnostics,
      errors: read.errors,
      id,
      markdown,
      path: target,
      readiness: {
        bodyReady: false,
        resourceReady: false,
        scaffoldValid: false
      },
      warnings: []
    };
    return {
      candidate: unreadableCandidate,
      changed: true,
      diagnostics: [],
      errors: [],
      status: "ok",
      warnings: uniqueSorted([...writeWarnings, ...read.errors])
    };
  }
  return {
    candidate: read.value,
    changed: true,
    diagnostics: [],
    errors: [],
    status: "ok",
    warnings: uniqueSorted([...writeWarnings, ...read.value.errors])
  };
}

async function listCandidatesFromRoot(
  investigationsDirectory: string
): Promise<InvestigationCandidateListResult> {
  const layout = await safeLayout(investigationsDirectory);
  if (layout.status === "error")
    return listFailure(layout.errors, layout.diagnostics);
  const candidates: InvestigationCandidate[] = [];
  const errors: string[] = [];
  const diagnostics: InvestigationDiagnostic[] = [];
  for (const id of layout.value.candidateIds) {
    const read = await readInvestigationCandidate(investigationsDirectory, id);
    if (read.status === "ok") {
      candidates.push(read.value);
    } else {
      errors.push(...read.errors);
      diagnostics.push(...read.diagnostics);
    }
  }
  return errors.length === 0
    ? {
        candidates,
        diagnostics: [],
        errors: [],
        status: "ok",
        warnings: candidates.flatMap((candidate) => candidate.errors)
      }
    : {
        candidates,
        diagnostics,
        errors: uniqueSorted(errors),
        status: "error",
        warnings: candidates.flatMap((candidate) => candidate.errors)
      };
}

export async function readInvestigationCandidate(
  investigationsDirectory: string,
  id: string
): Promise<
  | Readonly<{ status: "ok"; value: InvestigationCandidate }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>
> {
  const target = candidatePathForInvestigationId(investigationsDirectory, id);
  const read = await readCandidateMarkdown(target, id);
  if (read.status === "error") return read;
  const markdown = read.markdown;
  const scaffold = parseInvestigationReport(markdown, id, {
    allowEmptyCoreSections: true
  });
  const full = parseInvestigationReport(markdown, id);
  const scaffoldErrors = uniqueSorted([
    ...scaffold.frontmatterErrors,
    ...scaffold.bodyErrors
  ]);
  const resourceErrors = await candidateResourceErrors(
    investigationsDirectory,
    id,
    scaffold,
    scaffoldErrors
  );
  const bodyErrors = full.bodyErrors;
  const errors = uniqueSorted([
    ...scaffoldErrors,
    ...bodyErrors,
    ...resourceErrors
  ]);
  return {
    status: "ok",
    value: {
      diagnostics: [],
      errors,
      id,
      markdown,
      path: target,
      readiness: {
        bodyReady: scaffoldErrors.length === 0 && bodyErrors.length === 0,
        resourceReady:
          scaffoldErrors.length === 0 &&
          uniqueSorted(resourceErrors).length === 0,
        scaffoldValid: scaffoldErrors.length === 0
      },
      warnings: []
    }
  };
}

type CandidateReadFailure = Readonly<{
  diagnostics: InvestigationDiagnostic[];
  errors: string[];
  status: "error";
}>;

async function readCandidateMarkdown(
  target: string,
  id: string
): Promise<CandidateReadFailure | { markdown: string; status: "ok" }> {
  try {
    const entry = await fs.lstat(target);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error("candidate must be a regular non-symbolic-link file");
    }
    return { markdown: await fs.readFile(target, "utf8"), status: "ok" };
  } catch (error) {
    return {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.candidate-read-failed",
          error,
          reason: "the selected investigation candidate could not be read",
          recovery:
            "restore read access to the candidate, then retry the query",
          target
        })
      ],
      errors: [`${id} investigation candidate could not be read`],
      status: "error"
    };
  }
}

async function candidateResourceErrors(
  investigationsDirectory: string,
  id: string,
  scaffold: ReturnType<typeof parseInvestigationReport>,
  scaffoldErrors: readonly string[]
): Promise<string[]> {
  const resourceErrors = [...scaffold.resourceErrors];
  if (scaffoldErrors.length > 0 || scaffold.report === null)
    return resourceErrors;
  try {
    const references = await readCandidateAuthoringResourceReferences(
      investigationsDirectory
    );
    resourceErrors.push(
      ...(await validateCandidateInvestigationResources(
        investigationsDirectory,
        scaffold.report.resourceIds,
        references
      ))
    );
    const ownerPrefix = `${id.slice(0, -".md".length)}/`;
    const fullResources = await validateFullInvestigationResources(
      investigationsDirectory,
      references
    );
    resourceErrors.push(
      ...fullResources.warnings
        .filter((warning) =>
          warning.startsWith(
            `${investigationResourcesDirectoryName}/${ownerPrefix}`
          )
        )
        .map(
          (warning) =>
            `candidate owner resources must be directly referenced before publish: ${warning}`
        )
    );
  } catch (error) {
    resourceErrors.push(
      `candidate resource ownership could not be inspected: ${errorText(error)}`
    );
  }
  return resourceErrors;
}

export async function readCandidateAuthoringResourceReferences(
  investigationsDirectory: string,
  options: Readonly<{ failOnInvalidSources?: boolean }> = {}
): Promise<InvestigationResourceReferencesByReport> {
  const layout = await inspectInvestigationCollectionLayout(
    investigationsDirectory
  );
  const references = new Map<string, ReadonlySet<string>>();
  if (layout.errors.length > 0) return references;
  const sources = await readInvestigationSources(
    investigationsDirectory,
    layout.reportIds
  );
  recordFormalAuthoringReferences(
    sources,
    references,
    options.failOnInvalidSources === true
  );
  for (const id of layout.candidateIds) {
    await recordCandidateAuthoringReferences(
      investigationsDirectory,
      id,
      references,
      options.failOnInvalidSources === true
    );
  }
  return references;
}

function recordFormalAuthoringReferences(
  sources: readonly InvestigationSource[],
  references: Map<string, ReadonlySet<string>>,
  failOnInvalidSources: boolean
): void {
  for (const source of sources) {
    const built = buildInvestigationReportState(
      source.id,
      parseInvestigationReport(source.text, source.id)
    );
    if (built.status === "valid") {
      references.set(source.id, new Set(built.state.resourceIds));
    } else if (failOnInvalidSources) {
      throw new Error(
        `${source.id} authoring resource references could not be safely read`
      );
    }
  }
}

async function recordCandidateAuthoringReferences(
  investigationsDirectory: string,
  id: string,
  references: Map<string, ReadonlySet<string>>,
  failOnInvalidSources: boolean
): Promise<void> {
  try {
    const candidatePath = candidatePathForInvestigationId(
      investigationsDirectory,
      id
    );
    const entry = await fs.lstat(candidatePath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      throw new Error("candidate must be a regular non-symbolic-link file");
    }
    const markdown = await fs.readFile(candidatePath, "utf8");
    const parsed = parseInvestigationReport(markdown, id, {
      allowEmptyCoreSections: true
    });
    if (parsed.report !== null && parsed.errors.length === 0) {
      references.set(id, new Set(parsed.report.resourceIds));
    } else if (failOnInvalidSources) {
      throw new Error(
        "candidate must have a valid scaffold and resource links"
      );
    }
  } catch (error) {
    if (failOnInvalidSources) {
      throw new Error(
        `${id} authoring resource references could not be safely read`,
        { cause: error }
      );
    }
    // Read failures remain candidate diagnostics and cannot assert ownership.
  }
}

export function serializeInvestigationCandidate(
  input: Pick<
    InvestigationCandidateCreateOptions,
    "formedAt" | "question" | "relations" | "tags" | "title"
  >
): string {
  return [
    serializeInvestigationReportFrontmatter(input),
    "",
    "## 形成时背景",
    "",
    "## 调查目的",
    "",
    "## 调查范围与依据",
    "",
    "## 调查结果与边界",
    ""
  ].join("\n");
}

function prepareCandidateCreate(
  input: unknown
): Result<PreparedCandidateCreate, string[]> {
  const parsed = parseInvestigationCandidateCreateOptions(input);
  if (parsed.isErr()) return err(parsed.error);
  const candidateErrors = validateCandidateCreateOptions(parsed.value);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (candidateErrors.length > 0 || resolved.isErr()) {
    return err(
      uniqueSorted([
        ...candidateErrors,
        ...(resolved.isErr() ? resolved.error : [])
      ])
    );
  }
  return ok({
    candidate: canonicalCandidateCreateOptions(parsed.value),
    resolved: resolved.value
  });
}

function prepareCandidateLocation(
  input: unknown,
  requiresId: boolean
): Result<PreparedCandidateLocation, string[]> {
  const parsed = requiresId
    ? parseInvestigationCandidateShowOptions(input)
    : parseInvestigationCandidateListOptions(input);
  if (parsed.isErr()) return err(parsed.error);
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  return resolved.isErr()
    ? err(resolved.error)
    : ok({
        ...(requiresId
          ? { id: (parsed.value as InvestigationCandidateShowOptions).id }
          : {}),
        resolved: resolved.value
      });
}

function validateCandidateCreateOptions(
  candidate: InvestigationCandidateCreateOptions
): string[] {
  const errors: string[] = [];
  if (!isInvestigationId(candidate.id)) {
    errors.push(`${candidate.id || "<empty>"} must use an Investigation ID`);
  }
  for (const [name, value] of [
    ["title", candidate.title],
    ["question", candidate.question]
  ] as const) {
    if (!isNonEmptySingleLineText(value)) {
      errors.push(`${name} must be a non-empty single-line string`);
    }
  }
  if (investigationTimestampMilliseconds(candidate.formedAt) === null) {
    errors.push(
      "formedAt must use an RFC 3339 timestamp with timezone and second precision"
    );
  }
  if (candidate.tags.length === 0) {
    errors.push("tags must contain at least one tag");
  }
  if (candidate.tags.some((tag) => !isInvestigationTag(tag))) {
    errors.push("tags must contain valid kebab-case tokens");
  }
  if (new Set(candidate.tags).size !== candidate.tags.length) {
    errors.push("tags must not repeat a tag");
  }
  if (
    candidate.relations.some(
      (relation) =>
        !isInvestigationRelationType(relation.type) ||
        !isInvestigationId(relation.target)
    )
  ) {
    errors.push(
      "relations must use known types and valid Investigation ID targets"
    );
  }
  if (
    candidate.relations.some((relation) => relation.target === candidate.id)
  ) {
    errors.push("relations must not target the candidate itself");
  }
  if (
    new Set(candidate.relations.map((relation) => relation.target)).size !==
    candidate.relations.length
  ) {
    errors.push("relations must not repeat a target");
  }
  return uniqueSorted(errors);
}

function canonicalCandidateCreateOptions(
  candidate: InvestigationCandidateCreateOptions
): InvestigationCandidateCreateOptions {
  return {
    ...candidate,
    relations: canonicalRelations(candidate.relations),
    tags: [...candidate.tags].sort(compareText)
  };
}

function canonicalRelations(
  relations: readonly InvestigationRelation[]
): InvestigationRelation[] {
  return [...relations].sort((left, right) => {
    const typeOrder =
      relationTypeIndex(left.type) - relationTypeIndex(right.type);
    return typeOrder === 0 ? compareText(left.target, right.target) : typeOrder;
  });
}

function relationTypeIndex(type: InvestigationRelation["type"]): number {
  return investigationRelationTypes.indexOf(type);
}

async function safeLayout(investigationsDirectory: string): Promise<
  | Readonly<{
      status: "ok";
      value: Awaited<ReturnType<typeof inspectInvestigationCollectionLayout>>;
    }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>
> {
  try {
    const layout = await inspectInvestigationCollectionLayout(
      investigationsDirectory
    );
    return layout.errors.length === 0
      ? { status: "ok", value: layout }
      : {
          diagnostics: [],
          errors: layout.errors,
          status: "error"
        };
  } catch (error) {
    return {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.candidate-layout-unavailable",
          error,
          reason: "the investigation root could not be safely inspected",
          recovery: "resolve the reported root-directory problem, then retry",
          target: investigationsDirectory
        })
      ],
      errors: ["investigation root could not be safely inspected"],
      status: "error"
    };
  }
}

async function writeCandidateAtomically(
  target: string,
  markdown: string
): Promise<Result<Readonly<{ warnings: string[] }>, unknown>> {
  const candidateDirectory = path.dirname(target);
  const stagingDirectory = path.dirname(candidateDirectory);
  const temporary = path.join(
    stagingDirectory,
    `.investigation-candidate-${path.basename(target)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  let published = false;
  try {
    const [candidateStats, stagingStats] = await Promise.all([
      fs.stat(candidateDirectory),
      fs.stat(stagingDirectory)
    ]);
    if (candidateStats.dev !== stagingStats.dev) {
      throw new Error(
        "candidate staging directory is not on the investigation collection filesystem"
      );
    }
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(markdown, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.link(temporary, target);
    published = true;
    try {
      await fs.rm(temporary, { force: true });
      return ok({ warnings: [] });
    } catch (error) {
      return ok({
        warnings: [
          `candidate was created but its temporary creation file could not be removed: ${errorText(error)}`
        ]
      });
    }
  } catch (error) {
    return err(error);
  } finally {
    await handle?.close().catch(() => undefined);
    if (!published) {
      await fs.rm(temporary, { force: true }).catch(() => undefined);
    }
  }
}

function createFailure(
  status: "invalid-options" | "error",
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationCandidateCreateResult {
  return {
    candidate: null,
    changed: false,
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    status,
    warnings: []
  };
}

function listFailure(
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationCandidateListResult {
  return {
    candidates: [],
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    status: "error",
    warnings: []
  };
}

function showFailure(
  errors: readonly string[],
  diagnostics: readonly InvestigationDiagnostic[] = []
): InvestigationCandidateShowResult {
  return {
    candidate: null,
    diagnostics: [...diagnostics],
    errors: uniqueSorted(errors),
    status: "error",
    warnings: []
  };
}

function candidateOperationDiagnostic(
  error: unknown,
  investigationsDirectory: string
): InvestigationDiagnostic {
  if (error instanceof InvestigationCollectionMutationLockError) {
    return error.diagnostic;
  }
  return diagnosticFromError({
    code: "investigation-report.candidate-create-transaction-failed",
    error,
    reason:
      "the investigation candidate creation transaction stopped unexpectedly",
    recovery:
      "inspect the reported failure and candidate path before retrying the creation",
    target: investigationsDirectory
  });
}

function isNonEmptySingleLineText(value: string): boolean {
  return (
    value.trim().length > 0 &&
    !/[\r\n]/u.test(value) &&
    !hasC0ControlCharacter(value)
  );
}

function errorText(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : "unavailable error detail";
}

function hasC0ControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) <= 0x1f) return true;
  }
  return false;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
