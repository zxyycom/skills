import { synchronizeSelectedRecordIndex } from "../../../../record-operations/src/selected-synchronize.ts";
import {
  createDecisionStateIndexDefinition,
  decisionIndexFileName
} from "../../index/decision-index-definition.ts";
import {
  decisionIdFromMarkdown,
  establishedDecisionMetadataFromSource
} from "../../records/decision-metadata.ts";
import {
  isDecisionId,
  isDecisionSourcePath,
  normalizeDecisionSelectorInput,
  parseDatedDecisionId
} from "../../collection/decision-path.ts";
import { relatedPublishedDecisionIds } from "../../sources/decision-source-dependencies.ts";
import { decisionSourceRevision } from "../../sources/decision-source-revision.ts";
import { decisionIndexState } from "../../index/decision-state-snapshot.ts";
import { validateDecisionBody } from "../../records/record.ts";
import { decisionRelationConsistencyIssues } from "../../relations/relation-graph.ts";
import { ensureDecisionDirectoryPath } from "../../sources/decision-source-path-safety.ts";

export async function synchronizeSelectedDecisionIndex(
  root: string,
  workspaceRoot: string,
  selectors: readonly string[],
  preflight: boolean
) {
  await ensureDecisionDirectoryPath(workspaceRoot, root);
  return await synchronizeSelectedRecordIndex({
    root,
    indexPath: decisionIndexFileName,
    definition: createDecisionStateIndexDefinition(),
    mode: preflight ? "preview" : "write",
    selectors,
    selectorPolicy: {
      label: "Decision",
      codePrefix: "decision-records",
      normalize: normalizeDecisionSelectorInput,
      datedId: (selector) => parseDatedDecisionId(selector)?.id ?? null,
      nameFromId: (id) => parseDatedDecisionId(id)?.name ?? id
    },
    identity: decisionIdFromMarkdown,
    parse: async (source, availableIds) => {
      if (!isDecisionId(source.id) || !isDecisionSourcePath(source.sourcePath))
        throw new Error("Invalid selected Decision identity or source path");
      const errors: string[] = [];
      const parsed = await validateDecisionBody({
        body: source.text,
        expectedDecisionId: source.id,
        errors,
        sourcePath: source.sourcePath,
        targetExists: (id) => availableIds.has(id)
      });
      const metadata =
        parsed === null ? null : establishedDecisionMetadataFromSource(parsed);
      if (parsed === null || metadata === null || errors.length > 0)
        throw new Error(
          errors.join("; ") || "Selected source must be an established Decision"
        );
      return decisionIndexState(
        source.sourcePath,
        { ...parsed, ...metadata },
        source.id
      );
    },
    revision: (sources) =>
      decisionSourceRevision(
        sources.map((source) => ({
          decisionId: source.id,
          sourcePath: source.sourcePath,
          text: source.text
        }))
      ),
    dependencies: (index, selected) => [
      ...relatedPublishedDecisionIds(
        index,
        new Set([...selected].filter(isDecisionId))
      )
    ],
    graphErrors: (entries) =>
      decisionRelationConsistencyIssues(
        Object.entries(entries).map(([id, state]) => {
          if (!isDecisionId(id))
            throw new Error("Invalid published Decision ID");
          return {
            decisionId: id,
            projection: state,
            sourcePath: state.sourcePath,
            status: state.status
          };
        })
      ).map((issue) => issue.message)
  });
}
