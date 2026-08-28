import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import { createInvestigationStateSnapshot } from "./investigation-index-source.ts";
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
  InvestigationRelationSetOptions,
  InvestigationRelationSetResult,
  InvestigationSource
} from "./types.ts";

export type InvestigationAtomicWriter = (
  targetPath: string,
  text: string
) => Promise<void>;
type BeforeRelationPublish = () => Promise<void>;

export async function setInvestigationRelations(
  options: InvestigationRelationSetOptions
): Promise<InvestigationRelationSetResult> {
  return await setInvestigationRelationsWithWriter(
    options,
    writeTextAtomically
  );
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
  return await withTransactionLock(
    indexPath,
    async () =>
      await applyRelationReplacements({
        indexPath,
        replacements: validated.replacements,
        root,
        write,
        beforePublish
      })
  ).catch((error: unknown) =>
    relationResult(false, validated.sourceIds, indexPath, [errorText(error)])
  );
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
    return relationResult(false, sourceIds, options.indexPath, [
      `failed to read current index before relation transaction: ${errorText(error)}`
    ]);
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
    return relationResult(false, sourceIds, options.indexPath, [
      "investigation collection could not be revalidated before relation transaction; no files were written",
      ...protectedCollection.errors
    ]);
  }
  if (
    JSON.stringify(protectedCollection.snapshot.sourceRevision) !==
      JSON.stringify(collection.snapshot.sourceRevision) ||
    protectedCollection.sources.length !== collection.sources.length ||
    protectedCollection.sources.some(
      (source, index) =>
        source.id !== collection.sources[index]?.id ||
        source.text !== collection.sources[index]?.text
    )
  ) {
    return relationResult(false, sourceIds, options.indexPath, [
      "investigation collection changed after relation validation; no files were written"
    ]);
  }
  const originalTextByPath = new Map<string, string>();
  for (const source of collection.sources) {
    const reportPath = reportPathForInvestigationId(options.root, source.id);
    try {
      const currentText = await readRegularText(reportPath);
      if (currentText !== source.text) {
        return relationResult(false, sourceIds, options.indexPath, [
          `${source.id} changed after relation validation; no files were written`
        ]);
      }
      if (changedSources.includes(source.id)) {
        originalTextByPath.set(reportPath, currentText);
      }
    } catch (error) {
      return relationResult(false, sourceIds, options.indexPath, [
        `${source.id} could not be verified before relation transaction: ${errorText(error)}`
      ]);
    }
  }
  const currentIndexText = await readRegularText(options.indexPath).catch(
    () => null
  );
  if (currentIndexText !== originalIndexText) {
    return relationResult(false, sourceIds, options.indexPath, [
      "investigation index changed after relation validation; no files were written"
    ]);
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
    return relationResult(false, sourceIds, options.indexPath, [
      `relation transaction publish failed: ${errorText(error)}`,
      ...restorationErrors
    ]);
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

async function withTransactionLock<Result>(
  indexPath: string,
  operation: () => Promise<Result>
): Promise<Result> {
  const lockPath = path.join(
    path.dirname(path.dirname(indexPath)),
    `.${path.basename(indexPath)}.relations.lock`
  );
  let handle: Awaited<ReturnType<typeof fs.open>>;
  try {
    handle = await fs.open(lockPath, "wx");
  } catch (error) {
    throw new Error(
      `could not acquire investigation relation transaction lock ${lockPath}: ${errorText(error)}; retry after the active transaction completes`
    );
  }
  try {
    return await operation();
  } finally {
    await handle.close().catch(() => undefined);
    await fs.rm(lockPath, { force: true }).catch(() => undefined);
  }
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
  errors: readonly string[]
): InvestigationRelationSetResult {
  return {
    changed,
    errors: uniqueSorted(errors),
    indexPath,
    sourceIds: [...sourceIds].sort(compareText)
  };
}
function defaultIndexPath(input: unknown): string {
  const root =
    typeof input === "object" &&
    input !== null &&
    typeof (input as { workspaceRoot?: unknown }).workspaceRoot === "string"
      ? (input as { workspaceRoot: string }).workspaceRoot
      : ".";
  const dir =
    typeof input === "object" &&
    input !== null &&
    typeof (input as { investigationsDir?: unknown }).investigationsDir ===
      "string"
      ? (input as { investigationsDir: string }).investigationsDir
      : "docs/investigations";
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
  return error instanceof Error ? error.message : String(error);
}
