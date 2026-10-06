import * as v from "valibot";
import { parseYamlFrontmatter } from "../../shared/src/markdown/frontmatter.ts";

export const idSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
);
const text = v.pipe(v.string(), v.trim(), v.minLength(1));
const ids = v.optional(v.pipe(v.array(idSchema), v.readonly()), []);
const relation = v.pipe(
  v.strictObject({
    target: idSchema,
    relation: text,
    attitude: text,
    knowledge: text
  }),
  v.readonly()
);
export const cardSchema = v.pipe(
  v.strictObject({
    id: idSchema,
    title: text,
    kind: v.picklist(["summary", "detail"]),
    domain: v.picklist(["plot", "character", "setting", "history"]),
    status: v.picklist(["occurred", "expected", "mixed"]),
    completeness: v.picklist(["planned", "expanded"]),
    labels: v.optional(v.pipe(v.array(text), v.readonly()), []),
    children: ids,
    sources: ids,
    refs: ids,
    story_time: v.optional(text),
    narrative_position: v.optional(text),
    state_at: v.optional(idSchema),
    relations: v.optional(v.pipe(v.array(relation), v.readonly()), [])
  }),
  v.readonly()
);
export type Card = v.InferOutput<typeof cardSchema>;
export type CardRecord = Readonly<{
  card: Card;
  area: "current" | "reference";
  sourcePath: string;
  markdown: string;
  explicitRefs: readonly string[];
}>;

export type CardFailureCode =
  | "card-contract"
  | "card-format"
  | "duplicate-reference"
  | "duplicate-id"
  | "reference-child"
  | "child-domain"
  | "missing-reference"
  | "state-anchor"
  | "relation-target"
  | "children-cycle"
  | "source-path"
  | "source-changed"
  | "source-limit"
  | "read-failed"
  | "index-invalid"
  | "index-identity"
  | "card-not-found"
  | "reference-read-required";

export class CardFailure extends Error {
  constructor(
    readonly code: CardFailureCode,
    readonly file: string,
    message: string
  ) {
    super(message);
    this.name = "CardFailure";
  }
}

function validateUniqueReferences(card: Card, file: string): void {
  for (const field of ["children", "sources", "refs"] as const) {
    if (new Set(card[field]).size !== card[field].length) {
      throw new CardFailure(
        "duplicate-reference",
        file,
        `${field} 包含重复 ID`
      );
    }
  }
}

function validateDetail(card: Card, file: string): void {
  if (card.kind !== "detail") return;
  if (
    card.children.length > 0 ||
    card.status === "mixed" ||
    card.domain === "history"
  ) {
    throw new CardFailure(
      "card-contract",
      file,
      "详情不含 children/mixed；历史仅总结并引用剧情节点"
    );
  }
  if (
    ["character", "setting"].includes(card.domain) &&
    card.state_at === undefined
  ) {
    throw new CardFailure(
      "card-contract",
      file,
      "人物/设定详情必须以 state_at 指向明确剧情位置"
    );
  }
}

export function parseCard(markdown: string, file: string): Card {
  const frontmatter = parseYamlFrontmatter(markdown);
  if (frontmatter === null)
    throw new CardFailure("card-format", file, "缺少 YAML frontmatter");
  if (frontmatter.error !== null)
    throw new CardFailure("card-format", file, frontmatter.error);
  const parsed = v.safeParse(cardSchema, frontmatter.values);
  if (!parsed.success)
    throw new CardFailure("card-format", file, v.summarize(parsed.issues));
  const card = parsed.output;
  validateUniqueReferences(card, file);
  validateDetail(card, file);
  if (
    card.domain !== "character" &&
    Object.hasOwn(frontmatter.values, "relations")
  ) {
    throw new CardFailure("card-contract", file, "relations 仅由人物卡承接");
  }
  const body = markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u, "")
    .trim();
  if (!body) throw new CardFailure("card-format", file, "卡片正文不能为空");
  return card;
}

export function parseCardRecord(
  markdown: string,
  sourcePath: string,
  area: CardRecord["area"]
): CardRecord {
  const card = parseCard(markdown, sourcePath);
  const explicitRefs: string[] = [];
  const linkPrefix = "](card:";
  let offset = 0;
  while (offset < markdown.length) {
    const start = markdown.indexOf(linkPrefix, offset);
    if (start === -1) break;
    const targetStart = start + linkPrefix.length;
    const end = markdown.indexOf(")", targetStart);
    if (end === -1) break;
    const target = v.safeParse(idSchema, markdown.slice(targetStart, end));
    if (!target.success)
      throw new CardFailure(
        "card-format",
        sourcePath,
        "card: 括号引用必须为精确稳定 ID"
      );
    explicitRefs.push(target.output);
    offset = end + 1;
  }
  return { card, sourcePath, area, markdown, explicitRefs };
}

function collectIdentities(
  records: readonly CardRecord[]
): Map<string, CardRecord> {
  const byId = new Map<string, CardRecord>();
  for (const record of records) {
    if (byId.has(record.card.id))
      throw new CardFailure(
        "duplicate-id",
        record.sourcePath,
        `重复 ID ${record.card.id}`
      );
    byId.set(record.card.id, record);
  }
  return byId;
}

type ResolveCard = (id: string) => CardRecord;

function validateChildren(record: CardRecord, resolve: ResolveCard): void {
  for (const id of record.card.children) {
    const target = resolve(id);
    if (record.area === "current" && target.area === "reference") {
      throw new CardFailure(
        "reference-child",
        record.sourcePath,
        `当前展开不能纳入参考卡：${id}`
      );
    }
    const allowedDomains =
      record.card.domain === "history"
        ? ["history", "plot"]
        : [record.card.domain];
    if (!allowedDomains.includes(target.card.domain)) {
      throw new CardFailure(
        "child-domain",
        record.sourcePath,
        `children 域不匹配：${id}`
      );
    }
  }
}

function validateReferences(
  record: CardRecord,
  byId: ReadonlyMap<string, CardRecord>
): void {
  const resolve: ResolveCard = (id) => {
    const target = byId.get(id);
    if (!target)
      throw new CardFailure(
        "missing-reference",
        record.sourcePath,
        `不存在的卡片 ID：${id}`
      );
    return target;
  };
  const { card } = record;
  for (const id of [...card.sources, ...card.refs, ...record.explicitRefs])
    resolve(id);
  validateChildren(record, resolve);
  if (
    card.state_at !== undefined &&
    resolve(card.state_at).card.domain !== "plot"
  ) {
    throw new CardFailure(
      "state-anchor",
      record.sourcePath,
      "state_at 必须指向剧情卡"
    );
  }
  for (const edge of card.relations) {
    if (resolve(edge.target).card.domain !== "character") {
      throw new CardFailure(
        "relation-target",
        record.sourcePath,
        `人物关系目标必须为人物卡：${edge.target}`
      );
    }
  }
}

function requiredIndegree(
  indegree: ReadonlyMap<string, number>,
  id: string
): number {
  const count = indegree.get(id);
  if (count === undefined)
    throw new CardFailure(
      "missing-reference",
      "cards",
      `不存在的卡片 ID：${id}`
    );
  return count;
}

function validateContainmentCycles(
  records: readonly CardRecord[],
  byId: ReadonlyMap<string, CardRecord>
): void {
  // Kahn traversal is iterative: deep hierarchies do not consume the JS call stack.
  const indegree = new Map(records.map((record) => [record.card.id, 0]));
  for (const record of records) {
    for (const child of record.card.children)
      indegree.set(child, requiredIndegree(indegree, child) + 1);
  }
  const queue = records.filter((record) => indegree.get(record.card.id) === 0);
  let visited = 0;
  for (const record of queue) {
    visited += 1;
    for (const child of record.card.children) {
      const remaining = requiredIndegree(indegree, child) - 1;
      indegree.set(child, remaining);
      const target = byId.get(child);
      if (remaining === 0 && target) queue.push(target);
    }
  }
  if (visited !== records.length)
    throw new CardFailure("children-cycle", "cards", "children 图含循环");
}

export function validateCards(records: readonly CardRecord[]): void {
  const byId = collectIdentities(records);
  for (const record of records) validateReferences(record, byId);
  validateContainmentCycles(records, byId);
}
