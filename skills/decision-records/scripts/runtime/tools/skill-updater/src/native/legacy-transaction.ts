/*
 * Synced TypeScript runtime; repository maintenance edits tools/skill-updater/src/native/legacy-transaction.ts.
 * Installed skill copies may be edited directly; updates overwrite matching files.
 * Repository: https://github.com/zxyycom/skills
 * Source path: tools/skill-updater/src/native/legacy-transaction.ts
 * Maintained source: https://github.com/zxyycom/skills/blob/main/tools/skill-updater/src/native/legacy-transaction.ts
 * Skill source directory: https://github.com/zxyycom/skills/tree/main/skills/decision-records
 * Rebuild: bun run sync:decision-records-cli
 */
import fs from "node:fs/promises";
import path from "node:path";
import type { SkillFile } from "../types.ts";
import { planLegacyHandoff, type LegacyHandoffPlan } from "./legacy-plan.ts";
import type { LegacyFile } from "./legacy-preflight.ts";
import {
  readTargetFile,
  replaceTargetFile,
  sameFileState,
  type FileState
} from "./transaction-files.ts";
import { cleanupLegacy } from "./legacy-cleanup.ts";
import {
  assertFileModePolicy,
  digest,
  receipt,
  receiptPath,
  validateTransactionOptions,
  type LegacyTransactionOptions
} from "./legacy-state.ts";

type Written = Readonly<{
  name: string;
  before: FileState | null;
  installed: FileState;
  backup: string | null;
}>;

async function probeModes(
  stage: string,
  files: readonly SkillFile[]
): Promise<Map<string, number>> {
  const probe = path.join(stage, "mode-probe");
  await fs.writeFile(probe, "", { flag: "wx", mode: 0o600 });
  await fs.chmod(probe, 0o644);
  const normal = (await fs.lstat(probe)).mode & 0o777;
  await fs.chmod(probe, 0o755);
  const executable = (await fs.lstat(probe)).mode & 0o777;
  await fs.unlink(probe);
  return new Map(
    files.map((file) => [
      file.path,
      file.path.startsWith("bin/") ? executable : normal
    ])
  );
}

async function verifyWritten(
  root: string,
  written: readonly Written[]
): Promise<void> {
  for (const entry of written)
    if (!sameFileState(await readTargetFile(root, entry.name), entry.installed))
      throw new Error(`prepared file changed: ${entry.name}`);
}

async function rollback(
  root: string,
  written: readonly Written[]
): Promise<string[]> {
  const failures: string[] = [];
  for (const entry of [...written].reverse()) {
    try {
      const current = await readTargetFile(root, entry.name);
      if (!sameFileState(current, entry.installed))
        throw new Error("modified after replacement");
      const target = path.join(root, ...entry.name.split("/"));
      if (entry.backup === null) await fs.unlink(target);
      else await fs.rename(entry.backup, target);
      if (!sameFileState(await readTargetFile(root, entry.name), entry.before))
        throw new Error("restore readback mismatch");
    } catch {
      failures.push(entry.name);
    }
  }
  return failures;
}

async function makeBackup(
  stage: string,
  index: number,
  original: FileState | null
): Promise<string | null> {
  if (!original) return null;
  const backup = path.join(stage, `backup-${index}`);
  await fs.writeFile(backup, original.bytes, {
    flag: "wx",
    mode: original.mode
  });
  await fs.chmod(backup, original.mode);
  return backup;
}

type WriteRequest = Readonly<{
  root: string;
  stage: string;
  index: number;
  file: SkillFile;
  old: FileState | null;
  backup: string | null;
  written: Written[];
  createdDirectories: Set<string>;
}>;

async function writeOne(request: WriteRequest): Promise<void> {
  const { root, stage, index, file, old, backup, written } = request;
  const temporary = path.join(stage, `new-${index}`);
  const mode = file.path.startsWith("bin/") ? 0o755 : 0o644;
  await fs.writeFile(temporary, file.data, { flag: "wx", mode });
  await fs.chmod(temporary, mode);
  const stat = await fs.lstat(temporary);
  const staged: FileState = {
    bytes: Buffer.from(file.data),
    mode: stat.mode & 0o777
  };
  await replaceTargetFile(root, file.path, temporary, old, (directory) =>
    request.createdDirectories.add(directory)
  );
  written.push({ name: file.path, before: old, installed: staged, backup });
  const installed = await readTargetFile(root, file.path);
  if (!sameFileState(installed, staged))
    throw new Error(`installed readback failed: ${file.path}`);
  if (
    file.path.startsWith("bin/") &&
    process.platform !== "win32" &&
    (staged.mode & 0o111) === 0
  )
    throw new Error(`native binary is not executable: ${file.path}`);
}

type Activation = Readonly<{
  root: string;
  stage: string;
  plan: LegacyHandoffPlan;
  files: readonly SkillFile[];
  modes: ReadonlyMap<string, number>;
  rootCreated: boolean;
  createdDirectories: Set<string>;
}>;

type ActivationPolicy = Readonly<{
  allowEqual: boolean;
  plan: (root: string, names: readonly string[]) => Promise<LegacyHandoffPlan>;
}>;

async function createActivationStage(
  root: string,
  options: LegacyTransactionOptions
): Promise<{
  stage: string;
  modes: Map<string, number>;
  rootCreated: boolean;
}> {
  const stage = await fs.mkdtemp(
    path.join(path.dirname(root), `.${path.basename(root)}.native-`)
  );
  let modes: Map<string, number>;
  try {
    if (options.recoveryProof)
      await fs.writeFile(
        path.join(stage, "native-previous-proof.zip"),
        options.recoveryProof,
        { flag: "wx", mode: 0o600 }
      );
    modes = await probeModes(stage, options.files);
    assertFileModePolicy(options.files, modes);
  } catch (error) {
    throw new Error(
      `cannot determine native file permissions; inspect ${stage}`,
      { cause: error }
    );
  }
  let rootCreated = false;
  try {
    await fs.mkdir(root);
    rootCreated = true;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST"))
      throw error;
  }
  return { stage, modes, rootCreated };
}

async function prepareActivation(
  options: LegacyTransactionOptions,
  policy: ActivationPolicy
): Promise<Activation> {
  const root = path.resolve(options.target);
  const { names, entry } = validateTransactionOptions(
    options,
    policy.allowEqual
  );
  const plan = await policy.plan(root, [...names, receiptPath]);
  if (!(await options.confirm(plan)))
    throw new Error("native handoff cancelled before writes");
  const fresh = await policy.plan(root, [...names, receiptPath]);
  if (JSON.stringify(fresh) !== JSON.stringify(plan))
    throw new Error("native handoff plan changed after confirmation");
  const { stage, modes, rootCreated } = await createActivationStage(
    root,
    options
  );
  const files = [
    ...options.files.filter((file) => file.path !== "SKILL.md"),
    { path: receiptPath, data: receipt(options, plan, stage, modes) },
    entry
  ];
  return {
    root,
    stage,
    plan,
    files,
    modes,
    rootCreated,
    createdDirectories: new Set()
  };
}

async function verifiedOriginal(
  root: string,
  name: string,
  expected: LegacyFile | undefined
): Promise<FileState | null> {
  const original = await readTargetFile(root, name);
  if (
    expected &&
    (!original ||
      original.bytes.length !== expected.byteLength ||
      digest(original.bytes) !== expected.sha256)
  )
    throw new Error(`legacy target changed: ${name}`);
  if (!expected && original)
    throw new Error(`new target unexpectedly exists: ${name}`);
  return original;
}

async function applyActivationFile(
  context: Activation,
  options: LegacyTransactionOptions,
  item: { index: number; file: SkillFile },
  written: Written[]
): Promise<void> {
  const { root, stage, modes } = context;
  const { index, file } = item;
  if (file.path === "SKILL.md") {
    await options.validatePrepared(root);
    await verifyWritten(root, written);
  }
  const original = await verifiedOriginal(
    root,
    file.path,
    options.legacy.files[file.path]
  );
  const backup = await makeBackup(stage, index, original);
  await writeOne({
    root,
    stage,
    index,
    file,
    old: original,
    backup,
    written,
    createdDirectories: context.createdDirectories
  });
  if (
    file.path !== receiptPath &&
    written.at(-1)?.installed.mode !== modes.get(file.path)
  )
    throw new Error(`installed file mode differs from receipt: ${file.path}`);
}

async function removeCreatedDirectories(context: Activation): Promise<void> {
  for (const directory of [...context.createdDirectories].sort(
    (a, b) => b.length - a.length
  )) {
    try {
      await fs.rmdir(directory);
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
    }
  }
  if (context.rootCreated) await fs.rmdir(context.root);
}

async function applyActivationFiles(
  context: Activation,
  options: LegacyTransactionOptions
): Promise<Written[]> {
  const { root, stage, files } = context;
  const written: Written[] = [];
  try {
    for (const [index, file] of files.entries())
      await applyActivationFile(context, options, { index, file }, written);
  } catch (error) {
    const failures = await rollback(root, written);
    if (failures.length)
      throw new Error(
        `handoff failed; recovery incomplete for ${failures.join(", ")}; retain ${stage}`,
        { cause: error }
      );
    try {
      await removeCreatedDirectories(context);
      await fs.rm(stage, { recursive: true });
    } catch (cleanupError) {
      throw new Error(
        `handoff files restored; backup cleanup pending at ${stage}`,
        { cause: cleanupError }
      );
    }
    throw new Error("handoff failed before activation; changes restored", {
      cause: error
    });
  }
  return written;
}

/** Caller must supply a complete verified bundle, explicit confirmation and final-path validator. */
export async function activateWithPolicy(
  options: LegacyTransactionOptions,
  policy: ActivationPolicy
): Promise<void> {
  const context = await prepareActivation(options, policy);
  const { root, stage, plan } = context;
  const written = await applyActivationFiles(context, options);
  try {
    const entry = written.find((item) => item.name === receiptPath);
    if (!entry) throw new Error("cleanup receipt is missing");
    await cleanupLegacy(root, stage, plan, options, entry.installed);
  } catch (error) {
    throw new Error(`handoff activated; cleanup pending; inspect ${stage}`, {
      cause: error
    });
  }
}

/** Caller supplies the trusted legacy manifest and a verified incoming bundle. */
export async function activateLegacyBundle(
  options: LegacyTransactionOptions
): Promise<void> {
  return await activateWithPolicy(options, {
    allowEqual: false,
    plan: async (root, names) =>
      await planLegacyHandoff(root, options.role, options.legacy, names)
  });
}
