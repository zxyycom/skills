/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/rename-index-projection.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/rename-index-projection.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/rename-index-projection.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { InvestigationPreparation } from "./strict-preparation.ts";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import { createInvestigationStateSnapshot } from "./investigation-index-source.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { createInvestigationStateIndexDefinition } from "./investigation-state-index.ts";
import { validateInvestigationRelationGraph } from "./relation-validation.ts";
import { createInvestigationRelationContext } from "./relation-context.ts";
import { buildInvestigationReportState } from "./report-validation.ts";
import type { RenameSource } from "./rename-contract.ts";
import {
  errorText,
  readRegularText,
  lstatOrNull,
  renameStepFailure,
  type RenameStep
} from "./rename-support.ts";
import type { InvestigationIndexState, InvestigationSource } from "./types.ts";

export async function prepareNextIndex(
  root: string,
  indexPath: string,
  sources: readonly RenameSource[],
  preparation?: InvestigationPreparation
): Promise<
  RenameStep<
    Readonly<{ nextIndexText: string | null; oldIndexText: string | null }>
  >
> {
  const formal = sources.filter((source) => !source.candidate);
  const previous = await readRenameIndex(indexPath, preparation);
  if ("result" in previous) return previous;
  if (formal.length === 0)
    return { value: { nextIndexText: null, oldIndexText: previous.value } };
  const projected = await projectRenamedIndex(root, indexPath, formal);
  if ("result" in projected) return projected;
  return {
    value: { nextIndexText: projected.value, oldIndexText: previous.value }
  };
}

async function readRenameIndex(
  indexPath: string,
  preparation?: InvestigationPreparation
): Promise<RenameStep<string | null>> {
  try {
    if ((await lstatOrNull(indexPath)) === null) return { value: null };
    return {
      value:
        preparation === undefined
          ? await readRegularText(indexPath)
          : await preparation.read(indexPath)
    };
  } catch (error) {
    return renameStepFailure(indexPath, [
      "Investigation index could not be read before rename: " + errorText(error)
    ]);
  }
}

async function projectRenamedIndex(
  root: string,
  indexPath: string,
  sources: readonly RenameSource[]
): Promise<RenameStep<string>> {
  const states = new Map<string, InvestigationIndexState>();
  const formalSources: InvestigationSource[] = [];
  for (const source of sources) {
    const built =
      source.state === undefined
        ? buildInvestigationReportState(
            source.id,
            source.parsed ?? parseInvestigationReport(source.text, source.id),
            source.sourcePath
          )
        : { status: "valid" as const, state: source.state };
    if (built.status === "invalid")
      return renameStepFailure(indexPath, built.errors);
    states.set(source.id, built.state);
    formalSources.push({
      id: source.id,
      sourcePath: source.sourcePath,
      text: source.text
    });
  }
  const relationErrors = validateInvestigationRelationGraph(
    createInvestigationRelationContext(states)
  );
  if (relationErrors.length > 0)
    return renameStepFailure(indexPath, relationErrors);
  return await serializeRenamedIndex(root, indexPath, formalSources, states);
}

async function serializeRenamedIndex(
  root: string,
  indexPath: string,
  sources: readonly InvestigationSource[],
  states: ReadonlyMap<string, InvestigationIndexState>
): Promise<RenameStep<string>> {
  try {
    const snapshot = createInvestigationStateSnapshot(
      sources,
      sources.map((source) => states.get(source.id)!)
    );
    const definition = createInvestigationStateIndexDefinition({ snapshot });
    const index = await buildStateIndex(definition, { root });
    if (index.status === "error")
      return renameStepFailure(indexPath, [
        "Investigation rename could not build a complete derived index"
      ]);
    return { value: serializeStateIndex(index.value, definition) };
  } catch (error) {
    return renameStepFailure(indexPath, [
      "Investigation rename could not project the complete index: " +
        errorText(error)
    ]);
  }
}
