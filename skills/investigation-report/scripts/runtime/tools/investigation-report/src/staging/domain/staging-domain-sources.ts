/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/staging/domain/staging-domain-sources.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/staging/domain/staging-domain-sources.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/staging/domain/staging-domain-sources.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { hasEntry } from "../../../../index-runtime/src/index.ts";
import type { VersionControlFile } from "../../../../shared/src/version-control/index.ts";
import { investigationSourceRevision } from "../../index/investigation-source-revision.ts";
import { parseInvestigationReport } from "../../records/markdown.ts";
import { buildInvestigationReportState } from "../../records/report-validation.ts";
import { validateInvestigationResourceOwnership } from "../../resources/resources.ts";
import {
  compareText,
  decodeUtf8,
  type InvestigationIndex
} from "./staging-domain-support.ts";
import type { InvestigationIndexState } from "../../types.ts";

/** Source dependencies are fixed from selected published declarations, not discovery. */
export type DomainSourceSelection = Readonly<{
  deletedIds: readonly string[];
  reportIds: readonly string[];
  resourceIds: readonly string[];
}>;

export function domainSourceSelection(
  index: InvestigationIndex,
  selectedIds: readonly string[]
): DomainSourceSelection {
  const currentIds = selectedIds.filter((id) => hasEntry(index, id));
  const resourceIds = [
    ...new Set(currentIds.flatMap((id) => index.entries[id].resourceIds))
  ].sort(compareText);
  return {
    deletedIds: selectedIds.filter((id) => !hasEntry(index, id)),
    reportIds: currentIds.sort(compareText),
    resourceIds
  };
}

type DomainReportSources = Readonly<{
  files: ReadonlyMap<string, VersionControlFile>;
  index: InvestigationIndex;
  investigationsScope: string;
  selection: DomainSourceSelection;
}>;

/** Reuses phase bytes for complete document, identity, projection and owner checks. */
export function validateDomainReportSources(
  options: DomainReportSources
): void {
  const states = new Map<string, InvestigationIndexState>(
    Object.entries(options.index.entries)
  );
  for (const id of options.selection.reportIds)
    states.set(id, validatedDomainReport(id, options));
  const errors = validateInvestigationResourceOwnership(
    options.selection.resourceIds,
    new Map([...states].map(([id, state]) => [id, new Set(state.resourceIds)]))
  );
  if (errors.length > 0) throw new Error(errors.join("; "));
}

function validatedDomainReport(
  id: string,
  options: DomainReportSources
): InvestigationIndexState {
  if (!hasEntry(options.index, id))
    throw new Error(`Required formal owner does not exist: ${id}`);
  const state = options.index.entries[id];
  const reportPath = path.posix.join(
    options.investigationsScope,
    state.sourcePath
  );
  const file = options.files.get(reportPath);
  if (file === undefined)
    throw new Error(
      `Selected report or required owner is missing: ${reportPath}`
    );
  const text = decodeUtf8(file.data);
  const built = buildInvestigationReportState(
    id,
    parseInvestigationReport(text, id),
    state.sourcePath
  );
  if (built.status === "invalid") throw new Error(built.errors.join("; "));
  if (
    investigationSourceRevision([{ id, sourcePath: state.sourcePath, text }])
      .entries[id] !== options.index.sourceRevision.entries[id] ||
    !isDeepStrictEqual(built.state, state)
  )
    throw new Error(
      `Selected report or required owner changed from the published source: ${reportPath}; run scoped check and sync-index before retrying stage`
    );
  return built.state;
}
