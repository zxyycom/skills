/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/local-publication.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/local-publication.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/local-publication.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import path from "node:path";
import {
  expectationOf,
  parseStateIndex
} from "../../index-runtime/src/index.ts";
import {
  createInvestigationStateIndexDefinition,
  investigationIndexFileName
} from "./investigation-state-index.ts";
import {
  publishedGraphErrors,
  validatePublishedDependency
} from "./published-preparation.ts";
import { createInvestigationRelationContext } from "./relation-context.ts";
import { InvestigationPreparation } from "./strict-preparation.ts";
import type { ValidatedInvestigationCollection } from "./validation-collection.ts";
import type { PublishedInvestigationIndex } from "./published-preparation.ts";
import type { InvestigationSource } from "./types.ts";

/** A published baseline plus current proof only for the selected sources. */
export async function readLocalPublication(
  root: string,
  selected: readonly string[],
  preparation = new InvestigationPreparation(path.dirname(root), root)
): Promise<
  ValidatedInvestigationCollection & {
    snapshot: NonNullable<ValidatedInvestigationCollection["snapshot"]>;
    index: PublishedInvestigationIndex;
    indexText: string;
  }
> {
  const indexPath = path.join(root, investigationIndexFileName);
  const indexText = await preparation.read(indexPath);
  const definition = createInvestigationStateIndexDefinition();
  const loaded = parseStateIndex({
    definition,
    expectation: expectationOf(definition),
    sourcePath: indexPath,
    text: indexText
  });
  if (loaded.status === "error")
    throw new Error(
      "published investigation index is unavailable; run full sync-index before retrying"
    );
  const index = loaded.value;
  const states = new Map(Object.entries(index.entries));
  const errors = publishedGraphErrors(states);
  if (errors.length > 0) throw new Error(errors.join("; "));
  const sources: InvestigationSource[] = [];
  for (const id of selected) {
    const state = states.get(id);
    if (state === undefined)
      throw new Error(`${id} investigation report does not exist`);
    const source = {
      id,
      sourcePath: state.sourcePath,
      text: await preparation.read(path.join(root, state.sourcePath))
    };
    validatePublishedDependency(index, state, source);
    sources.push(source);
  }
  return {
    index,
    indexText,
    indexPath,
    sources,
    states,
    errors: [],
    warnings: [],
    reportCount: states.size,
    relations: createInvestigationRelationContext(states),
    snapshot: {
      metadata: index.metadata,
      sourceRevision: index.sourceRevision,
      states: index.entries
    }
  };
}
