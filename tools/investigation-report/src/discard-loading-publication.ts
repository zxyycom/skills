import type { InvestigationPreparation } from "./strict-preparation.ts";
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
    preparation: InvestigationPreparation;
  }>,
  ownership: Readonly<{
    ownedResources: ResourceTreeScan;
    reportPath: string;
    resourceOwnerPath: string;
    resourceProgress: import("./rename-contract.ts").ResourceMoveProgress;
  }>,
  indexText: string
) {
  return await publishPreparedDiscard(options, {
    indexText,
    preparation: loaded.preparation,
    originalIndexText: loaded.originalIndexText,
    originalSources: loaded.collection.sources,
    resourceProgress: ownership.resourceProgress,
    ownedResources: ownership.ownedResources,
    reportPath: ownership.reportPath,
    resourceOwnerPath: ownership.resourceOwnerPath
  });
}
