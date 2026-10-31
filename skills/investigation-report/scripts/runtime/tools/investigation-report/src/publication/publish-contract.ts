/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/publication/publish-contract.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/publication/publish-contract.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/publication/publish-contract.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
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
