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
