import { validateCards } from "./graph.ts";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  CardFailure,
  idSchema,
  parseCardRecord,
  versionKey,
  requiredTransition,
  type Card,
  type CardRecord,
  type Transition
} from "./card.ts";
import { currentSource, synchronize } from "./index.ts";
import { readSource } from "./source.ts";
import { sameStateSourceRevision } from "../../index-runtime/src/index.ts";
import {
  commitTransaction,
  type TransactionFile,
  type TransactionWriter
} from "./transaction.ts";

const markdownText = v.pipe(
  v.string(),
  v.check((value) => value.isWellFormed(), "Markdown必须为完整Unicode字符")
);
const inputSchema = v.pipe(
  v.strictObject({
    transition: markdownText,
    updates: v.pipe(
      v.array(
        v.pipe(
          v.strictObject({ id: idSchema, markdown: markdownText }),
          v.readonly()
        )
      ),
      v.maxLength(10000),
      v.readonly()
    )
  }),
  v.readonly()
);
type Batch = v.InferOutput<typeof inputSchema>;
export type ApplicationResult = Readonly<{
  status: "ok";
  changedFiles: readonly string[];
  semanticReview: "not-proven";
}>;

function validateObjectReplacement(
  before: CardRecord,
  after: CardRecord
): void {
  const identityChanged = (["id", "domain", "kind"] as const).some(
    (field) => before.card[field] !== after.card[field]
  );
  if (identityChanged || after.card.version !== before.card.version + 1)
    throw new CardFailure(
      "transition-contract",
      "input",
      "替换必须同对象/域/种类且version+1"
    );
  if (before.card.status !== "occurred") return;
  if (after.card.status === "expected")
    throw new CardFailure(
      "transition-contract",
      "input",
      "预期不能覆盖已发生状态"
    );
}
function validateStateApplication(
  data: Transition,
  transitionStatus: Card["status"],
  objectStatus: Card["status"]
): void {
  if (data.lifecycle !== "active")
    throw new CardFailure(
      "transition-contract",
      "input",
      "撤回不能应用对象状态"
    );
  if (transitionStatus !== "occurred")
    throw new CardFailure(
      "transition-contract",
      "input",
      "预期不能应用对象状态"
    );
  if (data.mode !== "evolution") return;
  if (objectStatus !== "occurred")
    throw new CardFailure(
      "transition-contract",
      "input",
      "预期对象不能应用为已发生演进"
    );
}

function replaceObject(
  records: readonly CardRecord[],
  update: Batch["updates"][number],
  transition: CardRecord
): readonly CardRecord[] {
  const data = requiredTransition(transition);
  const before = records.find(
    (record) => record.area === "current" && record.card.id === update.id
  );
  if (!before)
    throw new CardFailure(
      "card-not-found",
      "input",
      `更新目标必须为已有本作对象：${update.id}`
    );
  const after = parseCardRecord(update.markdown, before.sourcePath, "current");
  validateObjectReplacement(before, after);
  validateStateApplication(data, transition.card.status, after.card.status);
  if (
    !data.changes.some(
      (change) =>
        change.before === versionKey(before.card) &&
        change.after === versionKey(after.card)
    )
  )
    throw new CardFailure(
      "transition-contract",
      "input",
      "每个更新必须对应精确前后版本端点"
    );
  return [
    {
      ...before,
      area: "snapshot",
      sourcePath: `history/snapshots/${before.card.id}-v${before.card.version}.md`
    },
    after
  ];
}

function prepareTransition(
  records: readonly CardRecord[],
  markdown: string
): Readonly<{ transition: CardRecord; prior?: CardRecord }> {
  const transition = parseCardRecord(
    markdown,
    "history/transitions/pending.md",
    "transition"
  );
  const id = transition.card.id;
  const prior = records.find(
    (record) => record.area === "transition" && record.card.id === id
  );
  const priorVersion = prior?.card.version ?? 0;
  if (transition.card.version !== priorVersion + 1)
    throw new CardFailure(
      "transition-contract",
      "input",
      "变迁version须为已有版本+1或新记录1"
    );
  const priorOccurred = prior?.card.status === "occurred";
  const proposedExpected = transition.card.status === "expected";
  if (priorOccurred && proposedExpected)
    throw new CardFailure(
      "transition-contract",
      "input",
      "预期不能覆盖已发生变迁；另建计划记录"
    );
  requiredTransition(transition);
  return { transition, prior };
}

function proposedRecords(
  records: readonly CardRecord[],
  batch: Batch
): Readonly<{
  records: readonly CardRecord[];
  changed: readonly CardRecord[];
}> {
  const { transition, prior } = prepareTransition(records, batch.transition);
  const changed: CardRecord[] = [];
  const replaced = new Set<string>();
  for (const update of batch.updates) {
    if (replaced.has(update.id))
      throw new CardFailure("duplicate-id", "input", `重复更新${update.id}`);
    replaced.add(update.id);
    changed.push(...replaceObject(records, update, transition));
  }
  if (prior)
    changed.push({
      ...prior,
      area: "snapshot",
      sourcePath: `history/snapshots/${prior.card.id}-v${prior.card.version}.md`
    });
  changed.push({
    ...transition,
    sourcePath:
      prior?.sourcePath ?? `history/transitions/${transition.card.id}.md`
  });
  const proposed = [
    ...records.filter(
      (record) =>
        !(record.area === "current" && replaced.has(record.card.id)) &&
        record !== prior
    ),
    ...changed
  ];
  validateCards(proposed);
  return { records: proposed, changed };
}

async function stagedIndex(
  root: string,
  records: readonly CardRecord[]
): Promise<string> {
  const staging = await fs.mkdtemp(path.join(root, ".novel-cards-preview-"));
  try {
    await fs.mkdir(path.join(staging, "cards"));
    for (const record of records) {
      const file = path.join(staging, record.sourcePath);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, record.markdown, { flag: "wx" });
    }
    const result = await synchronize(staging);
    if (result.status !== "ok")
      throw new CardFailure(
        "index-invalid",
        "input",
        result.diagnostics.map((item) => item.message).join("; ")
      );
    return await fs.readFile(path.join(staging, "card-index.json"), "utf8");
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

async function readBatch(input: string): Promise<Batch> {
  let bytes: Buffer;
  try {
    const stat = await fs.lstat(input);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 20 * 1024 * 1024)
      throw new CardFailure(
        "source-path",
        input,
        "input须为普通单链接JSON，最大20MiB"
      );
    bytes = await fs.readFile(input);
  } catch (error) {
    if (error instanceof CardFailure) throw error;
    throw new CardFailure(
      "read-failed",
      input,
      error instanceof Error ? error.message : String(error)
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new CardFailure(
      "transition-contract",
      input,
      "input须为合法UTF-8 JSON"
    );
  }
  const parsed = v.safeParse(inputSchema, raw);
  if (!parsed.success)
    throw new CardFailure(
      "transition-contract",
      input,
      v.summarize(parsed.issues)
    );
  return parsed.output;
}

export async function applyTransition(
  root: string,
  input: string,
  writer?: TransactionWriter
): Promise<ApplicationResult> {
  const batch = await readBatch(input);
  const source = await currentSource(root);
  const proposed = proposedRecords(source.records, batch);
  const index = await stagedIndex(root, proposed.records);
  if (
    !sameStateSourceRevision(source.revision, (await readSource(root)).revision)
  )
    throw new CardFailure("source-changed", root, "批量校验期间来源改变");
  const files: TransactionFile[] = proposed.changed.map((record) => ({
    sourcePath: record.sourcePath,
    before:
      source.records.find((old) => old.sourcePath === record.sourcePath)
        ?.markdown ?? null,
    after: record.markdown
  }));
  files.push({
    sourcePath: "card-index.json",
    before: await fs.readFile(path.join(root, "card-index.json"), "utf8"),
    after: index
  });
  await commitTransaction(root, files, writer);
  return {
    status: "ok",
    changedFiles: files.map((file) => file.sourcePath),
    semanticReview: "not-proven"
  };
}
