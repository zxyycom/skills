import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic,
  sanitizeInvestigationDiagnosticText,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateSnapshot,
  sameInvestigationSources
} from "./investigation-index-source.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexDiagnosticMessages,
  investigationIndexFileName,
  syncInvestigationStateIndex
} from "./investigation-state-index.ts";
import { parseInvestigationRelationSetOptions } from "./options.ts";
import {
  canonicalizeInvestigationsDirectory,
  isInvestigationId,
  reportPathForInvestigationId,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import {
  compareInvestigationRelations,
  parseInvestigationReport,
  replaceInvestigationReportRelations
} from "./markdown.ts";
import { collectValidatedInvestigationCollection } from "./validation.ts";
import type {
  InvestigationIndexState,
  InvestigationRelationReplacement,
  InvestigationRelationSetResult,
  InvestigationSource
} from "./types.ts";

export type InvestigationAtomicWriter = (
  targetPath: string,
  text: string
) => Promise<void>;
type BeforeRelationPublish = () => Promise<void>;

export async function setInvestigationRelations(
  input: unknown
): Promise<InvestigationRelationSetResult> {
  return await setInvestigationRelationsWithWriter(input, writeTextAtomically);
}

export async function setInvestigationRelationsWithWriter(
  input: unknown,
  write: InvestigationAtomicWriter,
  beforePublish: BeforeRelationPublish = async () => {}
): Promise<InvestigationRelationSetResult> {
  const parsed = parseInvestigationRelationSetOptions(input);
  if (parsed.isErr()) {
    return relationResult(false, [], defaultIndexPath(input), parsed.error);
  }
  const validated = validateReplacements(parsed.value.replacements);
  if (validated.errors.length > 0) {
    return relationResult(
      false,
      validated.sourceIds,
      indexPathForOptions(parsed.value),
      validated.errors
    );
  }
  const resolved = resolveInvestigationsDirectory(
    parsed.value.workspaceRoot,
    parsed.value.investigationsDir
  );
  if (resolved.isErr()) {
    return relationResult(
      false,
      validated.sourceIds,
      indexPathForOptions(parsed.value),
      resolved.error
    );
  }
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) {
    return relationResult(
      false,
      validated.sourceIds,
      indexPathForOptions(parsed.value),
      canonical.error
    );
  }
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);
  return await withInvestigationCollectionMutationLock(
    indexPath,
    async () =>
      await applyRelationReplacements({
        indexPath,
        replacements: validated.replacements,
        root,
        write,
        beforePublish
      })
  ).catch((error: unknown) => {
    const releaseFailure =
      error instanceof InvestigationCollectionMutationLockError &&
      error.diagnostic.code ===
        "investigation-report.collection-lock-release-failed";
    const completedResult =
      error instanceof InvestigationCollectionMutationLockError &&
      error.operationCompleted &&
      isRelationResult(error.operationResult)
        ? error.operationResult
        : null;
    if (completedResult !== null && releaseFailure) {
      const mutation =
        completedResult.mutation ??
        relationMutation(
          completedResult.changed ? "committed-cleanup-pending" : "no-change"
        );
      return {
        ...completedResult,
        diagnostics: [
          ...completedResult.diagnostics,
          { ...error.diagnostic, mutation }
        ],
        errors: uniqueSorted([...completedResult.errors, errorText(error)]),
        mutation
      };
    }
    return relationResult(
      false,
      validated.sourceIds,
      indexPath,
      [errorText(error)],
      {
        diagnostics:
          error instanceof InvestigationCollectionMutationLockError
            ? [
                {
                  ...error.diagnostic,
                  mutation: relationMutation(
                    releaseFailure ? "partial-or-unknown" : "no-change"
                  )
                }
              ]
            : [
                diagnosticFromError({
                  code: "investigation-report.relation-transaction-failed",
                  error,
                  mutation: relationMutation("partial-or-unknown"),
                  reason: "the relation transaction stopped unexpectedly",
                  recovery:
                    "verify the selected reports and index before retrying the relation update",
                  target: indexPath
                })
              ],
        mutation: relationMutation(
          releaseFailure ? "partial-or-unknown" : "no-change"
        )
      }
    );
  });
}

async function applyRelationReplacements(options: {
  indexPath: string;
  replacements: readonly InvestigationRelationReplacement[];
  root: string;
  write: InvestigationAtomicWriter;
  beforePublish: BeforeRelationPublish;
}): Promise<InvestigationRelationSetResult> {
  const collection = await collectValidatedInvestigationCollection(
    options.root
  );
  const sourceIds = options.replacements
    .map((replacement) => replacement.source)
    .sort(compareText);
  if (collection.errors.length > 0 || collection.snapshot === null) {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      collection.errors
    );
  }
  let originalIndexText: string;
  try {
    originalIndexText = await readRegularText(options.indexPath);
  } catch (error) {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      [
        `failed to read current index before relation transaction: ${errorText(error)}`
      ],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.relation-index-read-failed",
            error,
            mutation: relationMutation("no-change"),
            reason:
              "the current investigation index could not be read before the relation transaction",
            recovery:
              "restore read access to the current index, then retry the relation update",
            target: options.indexPath
          })
        ],
        mutation: relationMutation("no-change")
      }
    );
  }
  const freshness = await syncInvestigationStateIndex({
    investigationsDirectory: options.root,
    mode: "check",
    snapshot: collection.snapshot
  });
  if (freshness.status === "error") {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      investigationIndexDiagnosticMessages(
        freshness.diagnostics,
        options.indexPath
      )
    );
  }
  const sourceById = new Map(
    collection.sources.map((source) => [source.id, source])
  );
  const replacementBySource = new Map(
    options.replacements.map((replacement) => [replacement.source, replacement])
  );
  for (const source of sourceIds) {
    if (!sourceById.has(source)) {
      return relationResult(false, sourceIds, options.indexPath, [
        `${source} investigation report does not exist`
      ]);
    }
  }
  const candidateSources: InvestigationSource[] = [];
  const candidateStates = new Map<string, InvestigationIndexState>();
  for (const source of collection.sources) {
    const replacement = replacementBySource.get(source.id);
    if (replacement === undefined) {
      candidateSources.push(source);
      candidateStates.set(source.id, collection.states.get(source.id)!);
      continue;
    }
    const parsed = parseInvestigationReport(source.text, source.id);
    if (parsed.report === null || parsed.errors.length > 0) {
      return relationResult(false, sourceIds, options.indexPath, parsed.errors);
    }
    const nextText = replaceInvestigationReportRelations(
      source.text,
      parsed.report,
      replacement.relations
    );
    const built = buildInvestigationReportState(
      source.id,
      parseInvestigationReport(nextText, source.id)
    );
    if (built.status === "invalid") {
      return relationResult(false, sourceIds, options.indexPath, built.errors);
    }
    candidateSources.push({ id: source.id, text: nextText });
    candidateStates.set(source.id, built.state);
  }
  const relationErrors = validateInvestigationRelationGraph(candidateStates);
  if (relationErrors.length > 0) {
    return relationResult(false, sourceIds, options.indexPath, relationErrors);
  }
  const changedSources = sourceIds.filter(
    (id) =>
      sourceById.get(id)?.text !==
      candidateSources.find((source) => source.id === id)?.text
  );
  if (changedSources.length === 0) {
    return relationResult(false, sourceIds, options.indexPath, []);
  }
  const snapshot = createInvestigationStateSnapshot(
    candidateSources,
    candidateSources.map((source) => candidateStates.get(source.id)!)
  );
  const builtIndex = await buildStateIndex(
    createInvestigationStateIndexDefinition({ snapshot }),
    { root: options.root }
  );
  if (builtIndex.status === "error") {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      investigationIndexDiagnosticMessages(
        builtIndex.diagnostics,
        options.indexPath
      )
    );
  }
  const nextIndexText = serializeStateIndex(
    builtIndex.value,
    createInvestigationStateIndexDefinition({ snapshot })
  );
  await options.beforePublish();
  const protectedCollection = await collectValidatedInvestigationCollection(
    options.root
  );
  if (
    protectedCollection.errors.length > 0 ||
    protectedCollection.snapshot === null
  ) {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      [
        "investigation collection could not be revalidated before relation transaction; no files were written",
        ...protectedCollection.errors
      ],
      {
        diagnostics: [
          genericInvestigationDiagnostic({
            code: "investigation-report.relation-source-recheck-failed",
            mutation: relationMutation("no-change"),
            reason:
              "the investigation collection could not be revalidated before relation publication",
            recovery:
              "correct the reported collection problem, then retry from the current collection state",
            target: options.root
          })
        ],
        mutation: relationMutation("no-change")
      }
    );
  }
  if (
    !sameInvestigationSources(protectedCollection.sources, collection.sources)
  ) {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      [
        "investigation collection changed after relation validation; no files were written"
      ],
      {
        diagnostics: [
          genericInvestigationDiagnostic({
            code: "investigation-report.relation-source-drift",
            mutation: relationMutation("no-change"),
            reason:
              "the investigation report sources changed after relation validation",
            recovery:
              "review the concurrent report change, then retry from the current collection state",
            target: options.root
          })
        ],
        mutation: relationMutation("no-change")
      }
    );
  }
  const originalTextByPath = new Map<string, string>();
  for (const source of collection.sources) {
    const reportPath = reportPathForInvestigationId(options.root, source.id);
    try {
      const currentText = await readRegularText(reportPath);
      if (currentText !== source.text) {
        return relationResult(
          false,
          sourceIds,
          options.indexPath,
          [
            `${source.id} changed after relation validation; no files were written`
          ],
          {
            diagnostics: [
              genericInvestigationDiagnostic({
                code: "investigation-report.relation-source-drift",
                mutation: relationMutation("no-change"),
                reason: `${source.id} changed after relation validation`,
                recovery:
                  "review the concurrent report change, then retry from the current collection state",
                target: source.id
              })
            ],
            mutation: relationMutation("no-change")
          }
        );
      }
      if (changedSources.includes(source.id)) {
        originalTextByPath.set(reportPath, currentText);
      }
    } catch (error) {
      return relationResult(
        false,
        sourceIds,
        options.indexPath,
        [
          `${source.id} could not be verified before relation transaction: ${errorText(error)}`
        ],
        {
          diagnostics: [
            diagnosticFromError({
              code: "investigation-report.relation-source-recheck-failed",
              error,
              mutation: relationMutation("no-change"),
              reason:
                "a report could not be re-read before the relation transaction",
              recovery:
                "restore access to the report and verify its current contents before retrying",
              target: source.id
            })
          ],
          mutation: relationMutation("no-change")
        }
      );
    }
  }
  let currentIndexText: string;
  try {
    currentIndexText = await readRegularText(options.indexPath);
  } catch (error) {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      [
        `current investigation index could not be re-read before relation transaction: ${errorText(error)}`
      ],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.relation-index-recheck-failed",
            error,
            mutation: relationMutation("no-change"),
            reason:
              "the current investigation index could not be re-read before publication",
            recovery:
              "restore read access to the index and verify it has not changed before retrying",
            target: options.indexPath
          })
        ],
        mutation: relationMutation("no-change")
      }
    );
  }
  if (currentIndexText !== originalIndexText) {
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      [
        "investigation index changed after relation validation; no files were written"
      ],
      {
        diagnostics: [
          genericInvestigationDiagnostic({
            code: "investigation-report.relation-index-drift",
            mutation: relationMutation("no-change"),
            reason: "the investigation index changed after relation validation",
            recovery:
              "review the concurrent index change, then retry from the current collection state",
            target: options.indexPath
          })
        ],
        mutation: relationMutation("no-change")
      }
    );
  }

  const nextTextById = new Map(
    candidateSources.map((source) => [source.id, source.text])
  );
  const writtenPaths: string[] = [];
  try {
    for (const id of changedSources.sort(compareText)) {
      const reportPath = reportPathForInvestigationId(options.root, id);
      writtenPaths.push(reportPath);
      await options.write(reportPath, nextTextById.get(id)!);
    }
    writtenPaths.push(options.indexPath);
    await options.write(options.indexPath, nextIndexText);
    return relationResult(true, sourceIds, options.indexPath, []);
  } catch (error) {
    const restorationErrors = await restoreOriginalTexts(
      options.indexPath,
      originalIndexText,
      originalTextByPath,
      writtenPaths,
      options.write
    );
    const outcome =
      restorationErrors.length === 0 ? "rolled-back" : "partial-or-unknown";
    return relationResult(
      false,
      sourceIds,
      options.indexPath,
      [
        `relation transaction publish failed: ${errorText(error)}`,
        ...restorationErrors
      ],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.relation-publish-failed",
            error,
            mutation: relationMutation(outcome),
            reason:
              outcome === "rolled-back"
                ? "relation publication failed and the original report and index bytes were restored"
                : "relation publication failed and restoration could not be fully verified",
            recovery:
              outcome === "rolled-back"
                ? "correct the publication failure, then retry the relation update"
                : "inspect the listed report and index paths before any retry",
            target: options.indexPath
          })
        ],
        mutation: relationMutation(outcome)
      }
    );
  }
}

function validateReplacements(
  replacements: readonly InvestigationRelationReplacement[]
): Readonly<{
  errors: string[];
  replacements: InvestigationRelationReplacement[];
  sourceIds: string[];
}> {
  const errors: string[] = [];
  const seen = new Set<string>();
  if (replacements.length === 0) {
    errors.push("set-relations requires at least one complete source group");
  }
  const normalized: InvestigationRelationReplacement[] = [];
  for (const replacement of replacements) {
    const source = replacement.source;
    if (!isInvestigationId(source)) {
      errors.push(
        `${replacement.source || "<empty>"} source must use an Investigation ID`
      );
      continue;
    }
    if (seen.has(source)) {
      errors.push(`${source} source appears more than once`);
      continue;
    }
    seen.add(source);
    const targets = new Set<string>();
    for (const relation of replacement.relations) {
      if (!isInvestigationId(relation.target)) {
        errors.push(
          `${source} relation target ${relation.target || "<empty>"} must use an Investigation ID`
        );
      }
      if (targets.has(relation.target)) {
        errors.push(
          `${source} relations must not repeat target ${relation.target}`
        );
      }
      targets.add(relation.target);
    }
    normalized.push({
      relations: [...replacement.relations].sort(compareInvestigationRelations),
      source
    });
  }
  const sorted = normalized.sort((left, right) =>
    compareText(left.source, right.source)
  );
  return {
    errors: uniqueSorted(errors),
    replacements: sorted,
    sourceIds: sorted.map((replacement) => replacement.source)
  };
}

async function writeTextAtomically(
  targetPath: string,
  text: string
): Promise<void> {
  await ensureRegularFile(targetPath);
  const temporaryPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(text, "utf8");
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(temporaryPath, targetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function restoreOriginalTexts(
  indexPath: string,
  originalIndexText: string,
  originalTextByPath: ReadonlyMap<string, string>,
  writtenPaths: readonly string[],
  write: InvestigationAtomicWriter
): Promise<string[]> {
  const errors: string[] = [];
  const paths = [...new Set(writtenPaths)]
    .filter((target) => target !== indexPath)
    .sort(compareText);
  for (const target of paths) {
    const original = originalTextByPath.get(target);
    if (original === undefined) continue;
    try {
      await write(target, original);
    } catch (error) {
      errors.push(`failed to restore report ${target}: ${errorText(error)}`);
    }
  }
  try {
    await write(indexPath, originalIndexText);
  } catch (error) {
    errors.push(
      `failed to restore investigation index ${indexPath}: ${errorText(error)}`
    );
  }
  return errors;
}

async function readRegularText(filePath: string): Promise<string> {
  await ensureRegularFile(filePath);
  return await fs.readFile(filePath, "utf8");
}

async function ensureRegularFile(filePath: string): Promise<void> {
  const entry = await fs.lstat(filePath);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("must be a regular non-symbolic-link file");
  }
}

function relationResult(
  changed: boolean,
  sourceIds: readonly string[],
  indexPath: string,
  errors: readonly string[],
  options: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    mutation?: InvestigationMutationDiagnostic;
  }> = {}
): InvestigationRelationSetResult {
  const sortedErrors = uniqueSorted(errors);
  return {
    changed,
    diagnostics:
      options.diagnostics === undefined
        ? sortedErrors.length === 0
          ? []
          : [
              genericInvestigationDiagnostic({
                code: "investigation-report.relation-update-failed",
                reason: sortedErrors.join("; "),
                recovery:
                  "correct the reported relation or collection problem, then retry the update",
                target: sourceIds.join(", ") || indexPath
              })
            ]
        : [...options.diagnostics],
    errors: sortedErrors,
    indexPath,
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    sourceIds: [...sourceIds].sort(compareText)
  };
}

function relationMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation report relation collection" };
}

function isRelationResult(
  value: unknown
): value is InvestigationRelationSetResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray(Reflect.get(value, "errors")) &&
    Array.isArray(Reflect.get(value, "diagnostics")) &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "sourceIds"))
  );
}
function defaultIndexPath(input: unknown): string {
  const root = rawStringField(input, "workspaceRoot") ?? ".";
  const dir =
    rawStringField(input, "investigationsDir") ?? "docs/investigations";
  return path.resolve(root, dir, investigationIndexFileName);
}
function indexPathForOptions(options: {
  investigationsDir?: string;
  workspaceRoot: string;
}): string {
  return path.resolve(
    options.workspaceRoot,
    options.investigationsDir ?? "docs/investigations",
    investigationIndexFileName
  );
}
function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function errorText(error: unknown): string {
  return sanitizeInvestigationDiagnosticText(error);
}
function rawStringField(input: unknown, field: string): string | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    return undefined;
  const value = Reflect.get(input, field);
  return typeof value === "string" ? value : undefined;
}
