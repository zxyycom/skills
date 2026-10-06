import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import { CardFailure } from "./card.ts";

export const journalDirectory = ".novel-cards-transaction";
const filePath = v.pipe(
  v.string(),
  v.regex(
    /^(?:card-index\.json|(?:cards|history\/(?:snapshots|transitions))\/(?:[^/\\]+\/)*[^/\\]+\.md)$/u
  ),
  v.check(
    (value) => !value.split("/").some((part) => part === "." || part === "..")
  )
);
const journalText = v.pipe(
  v.string(),
  v.check((value) => value.isWellFormed())
);
const entrySchema = v.pipe(
  v.strictObject({
    sourcePath: filePath,
    before: v.nullable(journalText),
    after: journalText
  }),
  v.readonly()
);
const journalSchema = v.strictObject({
  files: v.pipe(
    v.array(entrySchema),
    v.minLength(1),
    v.maxLength(20001),
    v.readonly()
  ),
  directories: v.pipe(v.array(v.string()), v.readonly())
});
export type TransactionFile = Readonly<v.InferOutput<typeof entrySchema>>;
type Journal = Readonly<v.InferOutput<typeof journalSchema>>;
export type TransactionWriter = (
  file: string,
  text: string,
  directory: string
) => Promise<void>;
export type RecoveryResult = Readonly<{
  status: "ok";
  recoveredFiles: number;
}>;

export async function pendingTransaction(root: string): Promise<boolean> {
  try {
    await fs.lstat(path.join(root, journalDirectory));
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}

async function regularText(file: string): Promise<string | null> {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.nlink !== 1)
      throw new CardFailure(
        "source-path",
        file,
        "事务目标必须为普通单链接文件"
      );
    const bytes = await fs.readFile(file);
    try {
      return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
        bytes
      );
    } catch {
      throw new CardFailure(
        "source-changed",
        file,
        "事务文件不是合法UTF-8；不能将替换字符视作相同原字节"
      );
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}

async function ensureParents(
  root: string,
  relative: string,
  created: string[],
  create = true
): Promise<void> {
  const components = relative.split("/").slice(0, -1);
  let directory = root;
  for (const component of components) {
    directory = path.join(directory, component);
    try {
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory())
        throw new CardFailure(
          "source-path",
          directory,
          "事务父目录不得为链接或文件"
        );
    } catch (error) {
      if (
        !(error instanceof Error && "code" in error && error.code === "ENOENT")
      )
        throw error;
      if (!create) return;
      await fs.mkdir(directory);
      created.push(path.relative(root, directory).split(path.sep).join("/"));
    }
  }
}

export async function atomicTransactionWrite(
  file: string,
  text: string,
  directory: string
): Promise<void> {
  const staged = path.join(directory, "replacement");
  await fs.writeFile(staged, text, { flag: "wx" });
  try {
    await fs.rename(staged, file);
  } finally {
    await fs.rm(staged, { force: true });
  }
}

async function restore(
  root: string,
  journal: Journal,
  directory: string
): Promise<void> {
  for (const entry of journal.files) {
    await ensureParents(root, entry.sourcePath, [], false);
    const actual = await regularText(path.join(root, entry.sourcePath));
    if (actual !== entry.before && actual !== entry.after)
      throw new CardFailure(
        "source-changed",
        entry.sourcePath,
        "恢复目标不是事务前/后字节；保留journal，不覆盖外部改动"
      );
  }
  for (const entry of [...journal.files].reverse()) {
    const file = path.join(root, entry.sourcePath);
    if (entry.before === null) await fs.rm(file, { force: true });
    else await atomicTransactionWrite(file, entry.before, directory);
  }
  await removeCreatedDirectories(root, journal.directories);
}

async function removeCreatedDirectories(
  root: string,
  directories: readonly string[]
): Promise<void> {
  for (const relative of [...directories].reverse()) {
    try {
      await fs.rmdir(path.join(root, relative));
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          "code" in error &&
          (error.code === "ENOTEMPTY" || error.code === "ENOENT")
        )
      )
        throw error;
    }
  }
}

async function requireTransactionRoot(root: string): Promise<void> {
  const stat = await fs.lstat(root);
  if (!stat.isDirectory())
    throw new CardFailure(
      "source-path",
      root,
      "事务根必须为真实目录，不接受符号链接"
    );
}
function validateJournalPaths(journal: Journal, directory: string): void {
  if (
    new Set(journal.files.map((file) => file.sourcePath)).size !==
    journal.files.length
  )
    throw new CardFailure(
      "transaction-failed",
      directory,
      "journal重复目标非法"
    );
  for (const relative of journal.directories) {
    if (!/^(?:cards|history)(?:\/[a-zA-Z0-9_-]+)*$/u.test(relative))
      throw new CardFailure(
        "transaction-failed",
        directory,
        "journal目录路径非法"
      );
  }
}

export async function recoverTransaction(
  root: string
): Promise<RecoveryResult> {
  await requireTransactionRoot(root);
  const directory = path.join(root, journalDirectory);
  if (!(await pendingTransaction(root)))
    throw new CardFailure("transaction-pending", directory, "没有待恢复事务");
  if (!(await fs.lstat(directory)).isDirectory())
    throw new CardFailure("source-path", directory, "journal必须为真实目录");
  const journalFile = path.join(directory, "journal.json");
  const input = await regularText(journalFile);
  if (input === null || Buffer.byteLength(input) > 100 * 1024 * 1024)
    throw new CardFailure(
      "transaction-failed",
      directory,
      "journal缺失或超限；需要人工检查，不自动删改"
    );
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    throw new CardFailure(
      "transaction-failed",
      journalFile,
      "journal须为合法JSON；保留现场，不自动删改"
    );
  }
  const parsed = v.safeParse(journalSchema, raw);
  if (!parsed.success)
    throw new CardFailure(
      "transaction-failed",
      journalFile,
      v.summarize(parsed.issues)
    );
  const journal = parsed.output;
  validateJournalPaths(journal, directory);
  await fs.rm(path.join(directory, "replacement"), { force: true });
  await restore(root, journal, directory);
  await fs.rm(directory, { recursive: true });
  return { status: "ok", recoveredFiles: journal.files.length };
}

async function prepareJournal(
  root: string,
  files: readonly TransactionFile[],
  directory: string
): Promise<Journal> {
  // Preflight is read-only. Missing parents of new files are not created here.
  for (const entry of files) {
    await ensureParents(root, entry.sourcePath, [], false);
    if ((await regularText(path.join(root, entry.sourcePath))) !== entry.before)
      throw new CardFailure(
        "source-changed",
        entry.sourcePath,
        "事务前目标字节改变"
      );
  }
  const directories: string[] = [];
  let createdJournal = false;
  try {
    for (const entry of files)
      await ensureParents(root, entry.sourcePath, directories);
    await fs.mkdir(directory);
    createdJournal = true;
    const journal = { files: [...files], directories };
    await fs.writeFile(
      path.join(directory, "journal.json"),
      JSON.stringify(journal),
      { flag: "wx" }
    );
    return journal;
  } catch (error) {
    if (createdJournal) await fs.rm(directory, { recursive: true });
    await removeCreatedDirectories(root, directories);
    throw error;
  }
}

export async function commitTransaction(
  root: string,
  files: readonly TransactionFile[],
  writer: TransactionWriter = atomicTransactionWrite
): Promise<void> {
  await requireTransactionRoot(root);
  const directory = path.join(root, journalDirectory);
  if (await pendingTransaction(root))
    throw new CardFailure(
      "transaction-pending",
      directory,
      "先执行recover --write"
    );
  const journal = await prepareJournal(root, files, directory);
  try {
    for (const entry of files)
      await writer(path.join(root, entry.sourcePath), entry.after, directory);
  } catch (error) {
    try {
      await restore(root, journal, directory);
      await fs.rm(directory, { recursive: true });
    } catch (recovery) {
      throw new CardFailure(
        "transaction-failed",
        directory,
        `写入失败且恢复未完成；保留journal，请recover --write：${String(error)}；${String(recovery)}`
      );
    }
    throw new CardFailure(
      "transaction-failed",
      directory,
      `写入失败，已恢复旧集合：${String(error)}`
    );
  }
  await fs.rm(directory, { recursive: true });
}
