/*
 * Synced TypeScript runtime; repository maintenance edits tools/investigation-report/src/publish-index-writer.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/investigation-report/src/publish-index-writer.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/investigation-report/src/publish-index-writer.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/investigation-report
 * Rebuild: bun run sync:investigation-report-check
 */
import type { RecordWriteIdentity } from "../../record-operations/src/transaction-files.ts";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";

export type InvestigationPublishWriteResult = Readonly<{
  warnings: string[];
  identity?: RecordWriteIdentity;
}>;

export async function writeIndexAtomically(
  indexPath: string,
  indexText: string,
  indexExisted: boolean
): Promise<InvestigationPublishWriteResult> {
  await validateIndexPublicationTarget(indexPath, indexExisted);
  const investigationDirectory = path.dirname(indexPath);
  const stagingDirectory = path.dirname(investigationDirectory);
  const temporaryPath = path.join(
    stagingDirectory,
    `.${path.basename(indexPath)}.${process.pid}.${randomUUID()}.publish`
  );
  let published = false;
  try {
    await validateIndexStagingFilesystem(
      investigationDirectory,
      stagingDirectory
    );
    const identity = await writeTemporaryIndex(
      temporaryPath,
      indexText,
      indexExisted ? (await fs.lstat(indexPath)).mode & 0o7777 : undefined
    );
    const result = await publishTemporaryIndex(
      temporaryPath,
      indexPath,
      indexExisted
    );
    published = true;
    return { ...result, identity };
  } finally {
    if (!published)
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function validateIndexPublicationTarget(
  indexPath: string,
  indexExisted: boolean
): Promise<void> {
  if (!indexExisted) return;
  const existing = await fs.lstat(indexPath);
  if (existing.isSymbolicLink() || !existing.isFile()) {
    throw new Error(
      "investigation index must be a regular non-symbolic-link file"
    );
  }
}
async function validateIndexStagingFilesystem(
  investigationDirectory: string,
  stagingDirectory: string
): Promise<void> {
  const [investigationStats, stagingStats] = await Promise.all([
    fs.stat(investigationDirectory),
    fs.stat(stagingDirectory)
  ]);
  if (investigationStats.dev !== stagingStats.dev) {
    throw new Error(
      "index staging directory is not on the investigation collection filesystem"
    );
  }
}
async function writeTemporaryIndex(
  temporaryPath: string,
  indexText: string,
  mode: number | undefined
): Promise<RecordWriteIdentity> {
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(indexText, "utf8");
    if (mode !== undefined) await handle.chmod(mode);
    await handle.sync();
    const actual = await handle.stat();
    return { dev: actual.dev, ino: actual.ino, mode: actual.mode & 0o7777 };
  } finally {
    await handle.close();
  }
}
async function publishTemporaryIndex(
  temporaryPath: string,
  indexPath: string,
  indexExisted: boolean
): Promise<InvestigationPublishWriteResult> {
  if (indexExisted) {
    await fs.rename(temporaryPath, indexPath);
    return { warnings: [] };
  }
  await fs.link(temporaryPath, indexPath);
  try {
    await fs.rm(temporaryPath, { force: true });
    return { warnings: [] };
  } catch (error) {
    return {
      warnings: [
        `investigation index was published but its temporary publication file could not be removed: ${sanitizeInvestigationDiagnosticText(error)}`
      ]
    };
  }
}
