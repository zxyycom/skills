import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeInvestigationDiagnosticText } from "./diagnostics.ts";

export type InvestigationPublishWriteResult = Readonly<{ warnings: string[] }>;

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
    await writeTemporaryIndex(temporaryPath, indexText);
    const result = await publishTemporaryIndex(
      temporaryPath,
      indexPath,
      indexExisted
    );
    published = true;
    return result;
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
  indexText: string
): Promise<void> {
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(indexText, "utf8");
    await handle.sync();
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
