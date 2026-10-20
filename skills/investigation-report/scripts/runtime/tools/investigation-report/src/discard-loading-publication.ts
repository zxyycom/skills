/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/discard-loading-publication.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/discard-loading-publication.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/discard-loading-publication.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type {
  DiscardCollectionOptions,
  ValidatedInvestigationCollection
} from "./discard.ts";
import { publishPreparedDiscard } from "./discard-protection.ts";
import type { ResourceTreeScan } from "./discard-history.ts";

export async function publishLoadedDiscard(
  options: DiscardCollectionOptions,
  loaded: Readonly<{
    collection: ValidatedInvestigationCollection;
    originalIndexText: string;
  }>,
  ownership: Readonly<{
    ownedResources: ResourceTreeScan;
    reportPath: string;
    resourceOwnerPath: string;
  }>,
  indexText: string
) {
  return await publishPreparedDiscard(options, {
    indexText,
    originalIndexText: loaded.originalIndexText,
    ownedResources: ownership.ownedResources,
    reportPath: ownership.reportPath,
    resourceOwnerPath: ownership.resourceOwnerPath
  });
}
