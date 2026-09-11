import {
  prepareInvestigationPublish,
  type InvestigationPublishPreparation
} from "./publish-preparation.ts";
import {
  currentIndexText,
  publishMutation,
  result
} from "./publish-support.ts";
import type { InvestigationCandidatePublishResult } from "./types.ts";

export type InitialPublishPreparation = Readonly<{
  originalIndexText: string | null;
  preparation: InvestigationPublishPreparation;
  status: "ready";
}>;
type PublishWithinLockOptions = Readonly<{
  ids: readonly string[];
  indexPath: string;
  root: string;
}>;

export async function initialPublishPreparation(
  options: PublishWithinLockOptions
): Promise<InitialPublishPreparation | InvestigationCandidatePublishResult> {
  const first = await prepareInvestigationPublish(options.root, options.ids);
  if (first.status === "error") {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      first.errors,
      {
        diagnostics: first.diagnostics,
        indexPath: options.indexPath,
        warnings: first.warnings,
        mutation: publishMutation("no-change")
      }
    );
  }
  const originalIndex = await currentIndexText(
    options.indexPath,
    first.value.indexExisted
  );
  if (originalIndex.status === "error") {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      originalIndex.errors,
      {
        diagnostics: originalIndex.diagnostics,
        indexPath: options.indexPath,
        warnings: first.warnings,
        mutation: publishMutation("no-change")
      }
    );
  }
  return {
    originalIndexText: originalIndex.value,
    preparation: first.value,
    status: "ready"
  };
}
