/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/rename-preparation-source.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/rename-preparation-source.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/rename-preparation-source.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { InvestigationPreparation } from "./strict-preparation.ts";
import type { InvestigationCollectionLayout } from "./investigation-layout.ts";
import path from "node:path";
import { findCandidatePathForInvestigationId } from "./candidate-path.ts";
import { inspectInvestigationCollectionLayout } from "./investigation-index-source.ts";
import {
  parseInvestigationReport,
  replaceInvestigationReportIdentity
} from "./markdown.ts";
import { investigationIndexFileName } from "./investigation-state-index.ts";
import {
  datedInvestigationIdForName,
  investigationNameFromId,
  isInvestigationId,
  parseDatedInvestigationId,
  utcInvestigationDate
} from "./report-path.ts";
import type { RenameSource } from "./rename-contract.ts";
import {
  compareText,
  errorText,
  readRegularText,
  renameStepFailure,
  type RenameStep
} from "./rename-support.ts";
import type {
  InvestigationIndexState,
  InvestigationSource,
  ParsedInvestigationReport
} from "./types.ts";

export function isNoOpRename(
  source: RenameSource,
  target: RenameTarget
): boolean {
  return source.id === target.id && source.sourcePath === target.sourcePath;
}

export async function inspectLayout(
  root: string,
  indexPath: string,
  preparation?: InvestigationPreparation
): Promise<
  RenameStep<Awaited<ReturnType<typeof inspectInvestigationCollectionLayout>>>
> {
  try {
    const layout = await inspectInvestigationCollectionLayout(root, {
      preparation
    });
    return layout.errors.length === 0
      ? { value: layout }
      : renameStepFailure(indexPath, layout.errors);
  } catch (error) {
    return renameStepFailure(indexPath, [
      "investigation collection could not be inspected: " + errorText(error)
    ]);
  }
}

export function asFormalSource(
  root: string,
  source: InvestigationSource,
  validated?: ParsedInvestigationReport,
  state?: InvestigationIndexState
): RenameSource {
  const parsed = validated ?? parseInvestigationReport(source.text, source.id);
  if (parsed.report === null || parsed.errors.length > 0) {
    throw new Error(
      `validated formal Investigation ${source.id} became invalid`
    );
  }
  return {
    candidate: false,
    parsed,
    state,
    document: parsed.report,
    filePath: path.join(root, source.sourcePath),
    id: source.id,
    sourcePath: source.sourcePath,
    text: source.text
  };
}

type CapturedRenameCandidates = Readonly<{
  layout: InvestigationCollectionLayout;
  preparation: InvestigationPreparation;
}>;

export async function readCandidateSources(
  root: string,
  candidateIds: readonly string[],
  captured?: CapturedRenameCandidates
): Promise<RenameStep<RenameSource[]>> {
  const candidates: RenameSource[] = [];
  const sourcesById = new Map(
    captured?.layout.candidateSources.map((source) => [source.id, source])
  );
  for (const id of candidateIds) {
    const loaded = await readRenameCandidate({
      root,
      id,
      source: sourcesById.get(id),
      captured
    });
    if ("result" in loaded) return loaded;
    candidates.push(loaded.value);
  }
  return { value: candidates };
}

type RenameCandidateRead = Readonly<{
  root: string;
  id: string;
  source: InvestigationSource | undefined;
  captured: CapturedRenameCandidates | undefined;
}>;

/** Acquire and validate one candidate, preserving the failure boundary of its locator. */
async function readRenameCandidate(
  input: RenameCandidateRead
): Promise<RenameStep<RenameSource>> {
  const { root, id, source, captured } = input;
  const filePath =
    captured === undefined
      ? await findCandidatePathForInvestigationId(root, id)
      : source && path.join(root, source.sourcePath);
  if (!filePath) {
    return renameStepFailure(path.join(root, investigationIndexFileName), [
      `Investigation candidate ${id} has no current source path`
    ]);
  }
  try {
    const { text, parsed } = await readRenameCandidateDocument(
      filePath,
      id,
      source,
      captured
    );
    if (parsed.report === null || parsed.frontmatterErrors.length > 0) {
      return renameStepFailure(path.join(root, investigationIndexFileName), [
        ...parsed.frontmatterErrors,
        `${id} candidate frontmatter cannot be renamed`
      ]);
    }
    return {
      value: {
        candidate: true,
        parsed,
        document: parsed.report,
        filePath,
        id,
        sourcePath: path.basename(filePath),
        text
      }
    };
  } catch (error) {
    return renameStepFailure(path.join(root, investigationIndexFileName), [
      `${id} candidate could not be read: ${errorText(error)}`
    ]);
  }
}

async function readRenameCandidateDocument(
  filePath: string,
  id: string,
  source: InvestigationSource | undefined,
  captured: CapturedRenameCandidates | undefined
): Promise<Readonly<{ text: string; parsed: ParsedInvestigationReport }>> {
  if (captured !== undefined) {
    if (source === undefined)
      throw new Error(
        "Strict Investigation preparation has no candidate proof: " + id
      );
    return {
      text: source.text,
      parsed: captured.preparation.parsed(source, true)
    };
  }
  const text = await readRegularText(filePath);
  return { text, parsed: parseInvestigationReport(text, id) };
}

export function resolveRenameSource(
  sources: readonly RenameSource[],
  rawSource: string,
  indexPath: string
): RenameStep<RenameSource> {
  const normalized = rawSource.replace(/\.md$/iu, "");
  const dated = parseDatedInvestigationId(normalized);
  const matches =
    dated === null
      ? sources.filter(
          (source) => investigationNameFromId(source.id) === normalized
        )
      : sources.filter((source) => source.id === dated.id);
  if (matches.length === 1) return { value: matches[0]! };
  return renameStepFailure(indexPath, [
    matches.length === 0
      ? `Investigation rename source does not exist: ${normalized}`
      : `Investigation rename source is ambiguous: ${normalized}; choose one standard ID: ${matches
          .map((source) => source.id)
          .sort(compareText)
          .join(", ")}`
  ]);
}

export type RenameTarget = Readonly<{
  id: string;
  name: string;
  sourcePath: string;
}>;

export function resolveRenameTarget(
  source: RenameSource,
  sources: readonly Pick<RenameSource, "id" | "sourcePath">[],
  rawTarget: string,
  indexPath: string
): RenameStep<RenameTarget> {
  const identity = targetIdentity(source, rawTarget, indexPath);
  if ("result" in identity) return identity;
  const others = sources.filter((candidate) => candidate.id !== source.id);
  const conflict = targetConflict(others, identity.value, indexPath);
  if (conflict !== null) return conflict;
  return targetSourcePath(source, others, identity.value, indexPath);
}

type RenameIdentity = Readonly<{ id: string; name: string }>;

function targetIdentity(
  source: RenameSource,
  rawTarget: string,
  indexPath: string
): RenameStep<RenameIdentity> {
  const normalized = rawTarget.replace(/\.md$/iu, "");
  const explicit = parseDatedInvestigationId(normalized);
  const sourceDate = utcInvestigationDate(source.document.formedAt);
  if (sourceDate === null)
    return renameStepFailure(indexPath, [
      `${source.id} has no valid formedAt UTC date for identity migration`
    ]);
  if (explicit !== null && explicit.date !== sourceDate)
    return renameStepFailure(indexPath, [
      `Target Investigation ID date must match formedAt UTC date ${sourceDate}`
    ]);
  const id =
    explicit?.id ??
    datedInvestigationIdForName(normalized, source.document.formedAt);
  if (id === null || !isInvestigationId(id))
    return renameStepFailure(indexPath, [
      `Investigation rename target must be a semantic name or calendar-valid YYMMDD-name ID: ${normalized}`
    ]);
  return { value: { id, name: investigationNameFromId(id) } };
}

function targetConflict(
  sources: readonly Pick<RenameSource, "id" | "sourcePath">[],
  target: RenameIdentity,
  indexPath: string
): RenameStep<never> | null {
  if (sources.some((candidate) => candidate.id === target.id))
    return renameStepFailure(indexPath, [
      `Target Investigation ID already exists: ${target.id}`
    ]);
  if (
    sources.some(
      (candidate) => investigationNameFromId(candidate.id) === target.name
    )
  )
    return renameStepFailure(indexPath, [
      `Target Investigation name already exists: ${target.name}`
    ]);
  return null;
}

function targetSourcePath(
  source: RenameSource,
  others: readonly Pick<RenameSource, "id" | "sourcePath">[],
  target: RenameIdentity,
  indexPath: string
): RenameStep<RenameTarget> {
  const namePath = source.candidate
    ? `_candidate.${target.name}`
    : `${target.name}.md`;
  const idPath = source.candidate
    ? `_candidate.${target.id}`
    : `${target.id}.md`;
  const occupied = new Set(others.map((candidate) => candidate.sourcePath));
  const sourcePath = occupied.has(namePath)
    ? occupied.has(idPath)
      ? null
      : idPath
    : namePath;
  return sourcePath === null
    ? renameStepFailure(indexPath, [
        `Both name and ID target paths are occupied for Investigation ${target.id}`
      ])
    : { value: { ...target, sourcePath } };
}

export function rewriteSources(
  sources: readonly RenameSource[],
  source: RenameSource,
  target: RenameTarget
): RenameStep<RenameSource[]> {
  const rewritten: RenameSource[] = [];
  for (const current of sources) {
    const text = replaceInvestigationReportIdentity(
      current.text,
      current.document,
      source.id,
      target.id
    );
    const id = current.id === source.id ? target.id : current.id;
    const sourcePath =
      current.id === source.id ? target.sourcePath : current.sourcePath;
    if (
      text === current.text &&
      id === current.id &&
      sourcePath === current.sourcePath
    ) {
      rewritten.push(current);
      continue;
    }
    const parsed = parseInvestigationReport(text, id);
    if (parsed.report === null || parsed.frontmatterErrors.length > 0) {
      return renameStepFailure("", [
        `Renamed Investigation source ${id} could not be validated`
      ]);
    }
    rewritten.push({
      ...current,
      document: parsed.report,
      parsed,
      state: undefined,
      id,
      sourcePath,
      text
    });
  }
  return { value: rewritten };
}
