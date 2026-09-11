import { inspectInvestigationCollectionLayout } from "./investigation-index-source.ts";
import {
  investigationSelectorEntries,
  resolveInvestigationSelector
} from "./investigation-selector.ts";

export async function resolvePublishCandidateSelectors(
  root: string,
  selectors: readonly string[]
): Promise<
  { ids: string[]; status: "ok" } | { errors: string[]; status: "error" }
> {
  const layout = await inspectInvestigationCollectionLayout(root);
  if (layout.errors.length > 0)
    return { errors: layout.errors, status: "error" };
  const entries = investigationSelectorEntries(layout.candidateIds);
  const ids: string[] = [];
  const errors: string[] = [];
  for (const selector of selectors) {
    const resolved = resolveInvestigationSelector(
      entries,
      selector,
      "investigation candidate"
    );
    if (resolved.status === "error") errors.push(...resolved.errors);
    else ids.push(resolved.id);
  }
  if (errors.length > 0)
    return { errors: [...new Set(errors)].sort(compareText), status: "error" };
  if (new Set(ids).size !== ids.length) {
    return {
      errors: ["publish selectors must resolve to distinct Investigation IDs"],
      status: "error"
    };
  }
  return { ids, status: "ok" };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
