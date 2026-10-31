import { loadInvestigationQueryIndex } from "../index/investigation-state-index.ts";
import { validatePublishedDependency } from "../publication/preparation/published-preparation.ts";
import path from "node:path";
import { readRecordText } from "../../../record-operations/src/source.ts";
import { discoverInvestigationCandidates } from "../candidates/candidate-discovery.ts";
import { parseInvestigationReport } from "../records/markdown.ts";
import { resolveInvestigationSelector } from "../collection/investigation-selector.ts";
import { investigationNameFromId } from "../collection/report-path.ts";
import {
  resolveRenameTarget,
  isNoOpRename
} from "./preparation/rename-preparation-source.ts";
import { noChangePreparation } from "./preparation/rename-plan.ts";
import {
  errorText,
  renameStepFailure,
  type RenameStep
} from "./rename-support.ts";
import type {
  InvestigationRenameOptions,
  PreparedRename,
  RenameSource
} from "./rename-contract.ts";

/** A true no-op needs identity/location safety, not unrelated body or history health. */
export async function prepareLocalNoOp(
  root: string,
  indexPath: string,
  options: InvestigationRenameOptions
): Promise<RenameStep<PreparedRename> | null> {
  const sourceSelector = options.source.replace(/\.md$/iu, "");
  const targetSelector = options.target.replace(/\.md$/iu, "");
  if (!couldBeSameIdentity(sourceSelector, targetSelector)) return null;
  try {
    const loaded = await loadLocalNoopSource(root, indexPath, sourceSelector);
    if ("result" in loaded) return loaded;
    const { source, identities } = loaded.value;
    const target = resolveRenameTarget(
      source,
      identities,
      options.target,
      indexPath
    );
    if ("result" in target) return target;
    return isNoOpRename(source, target.value)
      ? noChangePreparation(indexPath, [source], source, target.value)
      : null;
  } catch (error) {
    return renameStepFailure(indexPath, [errorText(error)]);
  }
}
function couldBeSameIdentity(source: string, target: string): boolean {
  return (
    source === target ||
    investigationNameFromId(source) === target ||
    investigationNameFromId(target) === source
  );
}
async function loadLocalNoopSource(
  root: string,
  indexPath: string,
  selector: string
): Promise<
  RenameStep<
    Readonly<{
      source: RenameSource;
      identities: readonly Pick<RenameSource, "id" | "sourcePath">[];
    }>
  >
> {
  const discovered = await discoverInvestigationCandidates(root);
  const identities = [...discovered.candidateCollection.identityById.values()];
  const selected = resolveInvestigationSelector(
    identities.map((identity) => ({
      ...identity,
      name: investigationNameFromId(identity.id)
    })),
    selector
  );
  if (selected.status === "error")
    return renameStepFailure(indexPath, selected.errors);
  const identity = discovered.candidateCollection.identityById.get(
    selected.id
  )!;
  const source = await readNoopIdentity(
    root,
    indexPath,
    identity,
    discovered.candidateCollection.candidateById.has(identity.id)
  );
  if ("result" in source) return source;
  return { value: { source: source.value, identities } };
}

async function readNoopIdentity(
  root: string,
  indexPath: string,
  identity: Pick<RenameSource, "id" | "sourcePath">,
  candidate: boolean
): Promise<RenameStep<RenameSource>> {
  const text = await readRecordText(root, identity.sourcePath);
  const parsed = parseInvestigationReport(text, identity.id);
  if (
    parsed.report === null ||
    parsed.frontmatterErrors.length > 0 ||
    parsed.report.id !== identity.id
  )
    return renameStepFailure(
      indexPath,
      parsed.frontmatterErrors.length > 0
        ? parsed.frontmatterErrors
        : ["Rename source must retain its exact declared identity"]
    );
  if (!candidate) {
    const validated = await validateNoopPublication(root, indexPath, {
      ...identity,
      text
    });
    if (validated !== null) return validated;
  }
  const source: RenameSource = {
    ...identity,
    text,
    filePath: path.join(root, identity.sourcePath),
    candidate,
    document: parsed.report
  };
  return { value: source };
}

async function validateNoopPublication(
  root: string,
  indexPath: string,
  source: Pick<RenameSource, "id" | "sourcePath" | "text">
): Promise<RenameStep<never> | null> {
  const loaded = await loadInvestigationQueryIndex({
    investigationsDirectory: root
  });
  if (loaded.status === "error")
    return renameStepFailure(indexPath, [
      "published index is unavailable; run full sync-index"
    ]);
  validatePublishedDependency(
    loaded.value,
    loaded.value.entries[source.id]!,
    source
  );
  return null;
}
