import path from "node:path";
import {
  parseInvestigationReport,
  replaceInvestigationReportIdentity
} from "./markdown.ts";
import {
  datedInvestigationIdForName,
  investigationNameFromId,
  isInvestigationId,
  parseDatedInvestigationId,
  utcInvestigationDate
} from "./report-path.ts";
import type { RenameSource } from "./rename-contract.ts";
import { renameStepFailure, type RenameStep } from "./rename-support.ts";
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
