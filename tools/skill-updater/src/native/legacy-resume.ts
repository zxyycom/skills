import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import type { SkillFile } from "../types.ts";
import { inspectLegacyBackups } from "./legacy-backups.ts";
import { cleanupLegacy } from "./legacy-cleanup.ts";
import {
  assertFileModePolicy,
  receipt,
  receiptPath,
  rejectUnknownRetiredFiles,
  validateTransactionOptions,
  type LegacyTransactionOptions
} from "./legacy-state.ts";
import {
  readTargetFile,
  sameFileState,
  type FileState
} from "./transaction-files.ts";
import type { LegacyHandoffPlan } from "./legacy-plan.ts";

async function verifyActivatedFiles(
  root: string,
  files: readonly SkillFile[],
  modes: ReadonlyMap<string, number>
): Promise<void> {
  for (const file of files) {
    const current = await readTargetFile(root, file.path);
    if (!current || !current.bytes.equals(file.data))
      throw new Error(`activated file differs: ${file.path}`);
    if (current.mode !== modes.get(file.path))
      throw new Error(`activated file mode differs: ${file.path}`);
    if (
      file.path.startsWith("bin/") &&
      process.platform !== "win32" &&
      (current.mode & 0o111) === 0
    )
      throw new Error(`native binary is not executable: ${file.path}`);
  }
}

type ResumeReceipt = Readonly<{
  stage: string;
  plan: LegacyHandoffPlan;
  modes: ReadonlyMap<string, number>;
  complete: Buffer;
  state: "cleanup-pending" | "complete";
}>;

const resumeMetadataSchema = v.object({
  state: v.picklist(["cleanup-pending", "complete"]),
  backup: v.string(),
  files: v.array(
    v.object({
      path: v.string(),
      mode: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(0o777))
    })
  )
});

function validateRecoveryPath(root: string, backup: string): string {
  const stage = path.resolve(backup);
  const prefix = `.${path.basename(root)}.native-`;
  if (
    path.dirname(stage) !== path.dirname(root) ||
    !path.basename(stage).startsWith(prefix) ||
    stage !== backup
  )
    throw new Error("invalid native recovery directory");
  return stage;
}

function validateResumeReceipt(
  root: string,
  saved: FileState,
  options: LegacyTransactionOptions
): ResumeReceipt {
  const parsed: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(saved.bytes)
  );
  const result = v.safeParse(resumeMetadataSchema, parsed);
  if (!result.success) throw new Error("invalid native cleanup receipt");
  const stage = validateRecoveryPath(root, result.output.backup);
  const included = new Set(options.files.map((file) => file.path));
  const plan = {
    add: [],
    replace: [],
    retire: Object.keys(options.legacy.files)
      .filter((name) => !included.has(name))
      .sort()
  };
  const modes = new Map(
    result.output.files.map((file) => [file.path, file.mode])
  );
  if (
    modes.size !== options.files.length ||
    options.files.some((file) => !modes.has(file.path))
  )
    throw new Error("native receipt file modes do not match bundle");
  assertFileModePolicy(options.files, modes);
  const pending = receipt(options, plan, stage, modes);
  const completed = JSON.parse(pending.toString("utf8")) as Record<
    string,
    unknown
  >;
  completed.state = "complete";
  const complete = Buffer.from(`${JSON.stringify(completed, null, 2)}\n`);
  const state = result.output.state;
  const expected = state === "complete" ? complete : pending;
  if (!saved.bytes.equals(expected))
    throw new Error(
      "native receipt does not match verified bundle and legacy manifest"
    );
  return { stage, plan, modes, complete, state };
}

/** Resume only after re-verifying the selected bundle and the known legacy manifest. */
export async function resumeLegacyCleanup(
  options: LegacyTransactionOptions
): Promise<void> {
  const root = path.resolve(options.target);
  if ((await fs.realpath(root)) !== root)
    throw new Error("native target is aliased");
  validateTransactionOptions(options);
  const saved = await readTargetFile(root, receiptPath);
  if (!saved) throw new Error("native cleanup receipt is missing");
  const { stage, plan, modes, complete, state } = validateResumeReceipt(
    root,
    saved,
    options
  );
  await verifyActivatedFiles(root, options.files, modes);
  await rejectUnknownRetiredFiles(root, options);
  const stageInfo = await fs.lstat(stage).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  });
  if (!stageInfo) {
    if (state !== "complete")
      throw new Error("native recovery directory is unavailable");
    for (const name of plan.retire)
      if (await readTargetFile(root, name))
        throw new Error(`retired file remains: ${name}`);
    await options.validatePrepared(root);
    await verifyActivatedFiles(root, options.files, modes);
    return;
  }
  await inspectLegacyBackups(
    stage,
    options.files,
    options.legacy,
    complete,
    state === "cleanup-pending"
  );
  if (!(await options.confirm(plan)))
    throw new Error("native cleanup cancelled before writes");
  await options.validatePrepared(root);
  await verifyActivatedFiles(root, options.files, modes);
  const fresh = await readTargetFile(root, receiptPath);
  if (!sameFileState(saved, fresh))
    throw new Error("native receipt changed after confirmation");
  await cleanupLegacy(root, stage, plan, options, saved);
}
