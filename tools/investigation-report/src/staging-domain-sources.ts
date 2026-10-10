import fs from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { hasEntry } from "../../index-runtime/src/index.ts";
import type { VersionControlFile } from "../../shared/src/version-control/index.ts";
import { investigationSourceRevision } from "./investigation-source-revision.ts";
import {
  investigationIdFromMarkdown,
  parseInvestigationReport
} from "./markdown.ts";
import { isInvestigationSourcePath } from "./report-path.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import { investigationResourceOwnerReportId } from "./resource-reference.ts";
import { validateInvestigationResourceOwnership } from "./resources.ts";
import {
  compareText,
  decodeUtf8,
  type InvestigationIndex
} from "./staging-domain-support.ts";
import type { InvestigationIndexState } from "./types.ts";

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
  const owners = resourceIds.map((id) =>
    investigationResourceOwnerReportId(id)!
  );
  return {
    deletedIds: selectedIds.filter((id) => !hasEntry(index, id)),
    reportIds: [...new Set([...currentIds, ...owners])].sort(compareText),
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
  const states = new Map<string, InvestigationIndexState>();
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

/** Only deletion selections need identity discovery to reject reappeared/moved IDs. */
export async function verifyDeletedDomainSources(
  investigationsDirectory: string,
  selection: DomainSourceSelection,
  acquired: ReadonlyMap<string, VersionControlFile>,
  investigationsScope: string
): Promise<void> {
  if (selection.deletedIds.length === 0) return;
  const deleted = new Set(selection.deletedIds);
  const entries = await fs.readdir(investigationsDirectory, {
    withFileTypes: true
  });
  for (const entry of entries) {
    if (!isInvestigationSourcePath(entry.name)) continue;
    if (!entry.isFile() || entry.isSymbolicLink())
      throw new Error(
        `Cannot discover deletion identities through non-ordinary source: ${entry.name}`
      );
    const file = acquired.get(path.posix.join(investigationsScope, entry.name));
    const text =
      file === undefined
        ? await fs.readFile(
            path.join(investigationsDirectory, entry.name),
            "utf8"
          )
        : decodeUtf8(file.data);
    const id = investigationIdFromMarkdown(text);
    if (id !== null && deleted.has(id))
      throw new Error(
        `Deleted Investigation ID reappeared in workspace: ${id}; sync-index before retrying stage`
      );
  }
}
