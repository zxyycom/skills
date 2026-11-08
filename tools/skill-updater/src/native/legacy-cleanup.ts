import fs from "node:fs/promises";
import path from "node:path";
import { inspectLegacyBackups, removeLegacyBackups } from "./legacy-backups.ts";
import {
  readTargetFile,
  replaceTargetFile,
  type FileState
} from "./transaction-files.ts";
import {
  digest,
  receiptPath,
  rejectUnknownRetiredFiles,
  type LegacyTransactionOptions
} from "./legacy-state.ts";
import type { LegacyManifest, LegacyHandoffPlan } from "./legacy-plan.ts";

export async function cleanupLegacy(
  root: string,
  stage: string,
  plan: LegacyHandoffPlan,
  options: LegacyTransactionOptions,
  existing: FileState
): Promise<void> {
  const complete = JSON.parse(existing.bytes.toString("utf8")) as Record<
    string,
    unknown
  >;
  const pending = complete.state === "cleanup-pending";
  complete.state = "complete";
  const completeBytes = Buffer.from(`${JSON.stringify(complete, null, 2)}\n`);
  await rejectUnknownRetiredFiles(root, options);
  const stageFiles = await inspectLegacyBackups(
    stage,
    options.files,
    options.legacy,
    completeBytes,
    pending
  );
  await retireVerifiedFiles(root, plan.retire, options.legacy);
  const temporary = path.join(stage, "complete-receipt");
  if (stageFiles.includes("complete-receipt")) await fs.unlink(temporary);
  await fs.writeFile(temporary, completeBytes, {
    flag: "wx",
    mode: existing.mode
  });
  await fs.chmod(temporary, existing.mode);
  await replaceTargetFile(root, receiptPath, temporary, existing);
  const finalReceipt = await readTargetFile(root, receiptPath);
  if (!finalReceipt || !finalReceipt.bytes.equals(completeBytes))
    throw new Error("receipt readback failed");
  await removeLegacyBackups(
    stage,
    options.files,
    options.legacy,
    completeBytes
  );
}

async function retireVerifiedFiles(
  root: string,
  retired: readonly string[],
  legacy: LegacyManifest
): Promise<void> {
  for (const name of retired) {
    const current = await readTargetFile(root, name);
    if (!current) continue;
    const expected = legacy.files[name];
    if (
      !expected ||
      current.bytes.length !== expected.byteLength ||
      digest(current.bytes) !== expected.sha256
    )
      throw new Error(`retired file changed: ${name}`);
    await fs.unlink(path.join(root, ...name.split("/")));
    if (await readTargetFile(root, name))
      throw new Error(`retired file remains: ${name}`);
  }
}
