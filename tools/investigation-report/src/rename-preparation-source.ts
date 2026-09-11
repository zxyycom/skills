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
import type { InvestigationSource } from "./types.ts";

export function isNoOpRename(
  source: RenameSource,
  target: RenameTarget
): boolean {
  return source.id === target.id && source.sourcePath === target.sourcePath;
}

export async function inspectLayout(
  root: string,
  indexPath: string
): Promise<
  RenameStep<Awaited<ReturnType<typeof inspectInvestigationCollectionLayout>>>
> {
  try {
    const layout = await inspectInvestigationCollectionLayout(root);
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
  source: InvestigationSource
): RenameSource {
  const parsed = parseInvestigationReport(source.text, source.id);
  if (parsed.report === null || parsed.errors.length > 0) {
    throw new Error(
      `validated formal Investigation ${source.id} became invalid`
    );
  }
  return {
    candidate: false,
    document: parsed.report,
    filePath: path.join(root, source.sourcePath),
    id: source.id,
    sourcePath: source.sourcePath,
    text: source.text
  };
}

export async function readCandidateSources(
  root: string,
  candidateIds: readonly string[]
): Promise<RenameStep<RenameSource[]>> {
  const candidates: RenameSource[] = [];
  for (const id of candidateIds) {
    const filePath = await findCandidatePathForInvestigationId(root, id);
    if (filePath === null) {
      return renameStepFailure(path.join(root, investigationIndexFileName), [
        `Investigation candidate ${id} has no current source path`
      ]);
    }
    try {
      const text = await readRegularText(filePath);
      const parsed = parseInvestigationReport(text, id);
      if (parsed.report === null || parsed.frontmatterErrors.length > 0) {
        return renameStepFailure(path.join(root, investigationIndexFileName), [
          ...parsed.frontmatterErrors,
          `${id} candidate frontmatter cannot be renamed`
        ]);
      }
      candidates.push({
        candidate: true,
        document: parsed.report,
        filePath,
        id,
        sourcePath: path.basename(filePath),
        text
      });
    } catch (error) {
      return renameStepFailure(path.join(root, investigationIndexFileName), [
        `${id} candidate could not be read: ${errorText(error)}`
      ]);
    }
  }
  return { value: candidates };
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
  sources: readonly RenameSource[],
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
  sources: readonly RenameSource[],
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
  others: readonly RenameSource[],
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
    const parsed = parseInvestigationReport(text, id);
    if (parsed.report === null || parsed.frontmatterErrors.length > 0) {
      return renameStepFailure("", [
        `Renamed Investigation source ${id} could not be validated`
      ]);
    }
    rewritten.push({
      ...current,
      document: parsed.report,
      id,
      sourcePath,
      text
    });
  }
  return { value: rewritten };
}
