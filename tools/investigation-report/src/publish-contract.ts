import type { InvestigationPublishWriteResult } from "./publish-index-writer.ts";

export type InvestigationPublishWriter = (
  indexPath: string,
  indexText: string,
  indexExisted: boolean
) => Promise<void | InvestigationPublishWriteResult>;
export type BeforeInvestigationPublish = () => Promise<void>;
export type PublishWithinLockOptions = Readonly<{
  beforePublish: BeforeInvestigationPublish;
  ids: readonly string[];
  indexPath: string;
  root: string;
  write: InvestigationPublishWriter;
}>;
