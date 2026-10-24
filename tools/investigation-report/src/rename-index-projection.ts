import type { InvestigationPreparation } from "./strict-preparation.ts";
import {
  buildStateIndex,
  serializeStateIndex
} from "../../index-runtime/src/index.ts";
import {
  publicationSnapshot,
  publishedGraphErrors
} from "./published-preparation.ts";
import {
  expectationOf,
  parseStateIndex
} from "../../index-runtime/src/index.ts";
import { parseInvestigationReport } from "./markdown.ts";
import { createInvestigationStateIndexDefinition } from "./investigation-state-index.ts";
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
  preparation?: InvestigationPreparation,
  retiredId?: string
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
  const projected = await projectRenamedIndex(
    root,
    indexPath,
    formal,
    previous.value,
    retiredId
  );
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
          : await preparation.readOrCaptured(indexPath)
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
  sources: readonly RenameSource[],
  previousText: string | null,
  retiredId: string | undefined
): Promise<RenameStep<string>> {
  if (previousText === null)
    return renameStepFailure(indexPath, [
      "published index is required before formal rename"
    ]);
  const definition = createInvestigationStateIndexDefinition();
  const parsed = parseStateIndex({
    definition,
    expectation: expectationOf(definition),
    sourcePath: indexPath,
    text: previousText
  });
  if (parsed.status === "error")
    return renameStepFailure(indexPath, [
      "published index is invalid; run full sync-index"
    ]);
  const baseline = parsed.value;
  const states = new Map<string, InvestigationIndexState>(
    Object.entries(baseline.entries)
  );
  if (retiredId !== undefined) states.delete(retiredId);
  const projected = projectRenameSources(sources, states, indexPath);
  if ("result" in projected) return projected;
  const relationErrors = publishedGraphErrors(states);
  if (relationErrors.length > 0)
    return renameStepFailure(indexPath, relationErrors);
  return await serializeRenamedIndex(
    root,
    indexPath,
    projected.value,
    states,
    baseline
  );
}

function projectRenameSources(
  sources: readonly RenameSource[],
  states: Map<string, InvestigationIndexState>,
  indexPath: string
): RenameStep<InvestigationSource[]> {
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
  return { value: formalSources };
}

async function serializeRenamedIndex(
  root: string,
  indexPath: string,
  sources: readonly InvestigationSource[],
  states: ReadonlyMap<string, InvestigationIndexState>,
  baseline: import("./published-preparation.ts").PublishedInvestigationIndex
): Promise<RenameStep<string>> {
  try {
    const revisions = { ...baseline.sourceRevision.entries };
    for (const id of Object.keys(revisions))
      if (!states.has(id)) delete revisions[id];
    const snapshot = publicationSnapshot(
      {
        metadata: baseline.metadata,
        sourceRevision: { ...baseline.sourceRevision, entries: revisions },
        states: baseline.entries
      },
      states,
      sources
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
