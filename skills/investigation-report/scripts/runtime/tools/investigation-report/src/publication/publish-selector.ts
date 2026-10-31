/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/publication/publish-selector.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/publication/publish-selector.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/publication/publish-selector.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import { inspectInvestigationCollectionLayout } from "../index/investigation-index-source.ts";
import {
  investigationSelectorEntries,
  createInvestigationSelectorResolver
} from "../collection/investigation-selector.ts";

export async function resolvePublishCandidateSelectors(
  root: string,
  selectors: readonly string[]
): Promise<
  { ids: string[]; status: "ok" } | { errors: string[]; status: "error" }
> {
  const layout = await inspectInvestigationCollectionLayout(root, {
    readFormalSources: false
  });
  if (layout.errors.length > 0)
    return { errors: layout.errors, status: "error" };
  const entries = investigationSelectorEntries(layout.candidateIds);
  const resolve = createInvestigationSelectorResolver(entries);
  const ids: string[] = [];
  const errors: string[] = [];
  for (const selector of selectors) {
    const resolved = resolve(selector, "investigation candidate");
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
