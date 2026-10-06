import * as v from "valibot";
import { parseYamlFrontmatter } from "../../shared/src/markdown/frontmatter.ts";

export const idSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
);
const text = v.pipe(v.string(), v.trim(), v.minLength(1));
export const referenceSchema = v.pipe(
  v.string(),
  v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:@[1-9][0-9]*)?$/u)
);
const versionReference = v.pipe(referenceSchema, v.regex(/@[1-9][0-9]*$/u));
const positiveInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(1));
const ids = v.optional(v.pipe(v.array(referenceSchema), v.readonly()), []);
const transitionSchema = v.pipe(
  v.strictObject({
    mode: v.picklist(["evolution", "revision"]),
    lifecycle: v.picklist(["active", "withdrawn"]),
    events: v.pipe(v.array(versionReference), v.readonly()),
    changes: v.pipe(
      v.array(
        v.pipe(
          v.strictObject({ before: versionReference, after: versionReference }),
          v.readonly()
        )
      ),
      v.minLength(1),
      v.readonly()
    ),
    supersedes: v.optional(v.pipe(v.array(versionReference), v.readonly()), [])
  }),
  v.readonly()
);
const relation = v.pipe(
  v.strictObject({
    target: referenceSchema,
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
    version: v.optional(positiveInteger, 1),
    chapter: v.optional(
      v.pipe(
        v.strictObject({ scope: idSchema, number: positiveInteger }),
        v.readonly()
      )
    ),
    transition: v.optional(transitionSchema),
    kind: v.picklist(["summary", "detail", "transition"]),
    domain: v.picklist(["plot", "character", "setting", "history"]),
    status: v.picklist(["occurred", "expected", "mixed"]),
    completeness: v.picklist(["planned", "expanded"]),
    labels: v.optional(v.pipe(v.array(text), v.readonly()), []),
    children: ids,
    sources: ids,
    refs: ids,
    story_time: v.optional(text),
    narrative_position: v.optional(text),
    state_at: v.optional(referenceSchema),
    relations: v.optional(v.pipe(v.array(relation), v.readonly()), [])
  }),
  v.readonly()
);
export type Card = v.InferOutput<typeof cardSchema>;
export type Transition = NonNullable<Card["transition"]>;
export type CardRecord = Readonly<{
  card: Card;
  area: "current" | "reference" | "snapshot" | "transition";
  sourcePath: string;
  markdown: string;
  explicitRefs: readonly string[];
  referenceContext?:
    | "current"
    | "snapshot-unqualified-current-not-historical"
    | "snapshot-version-locked";
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
  | "reference-read-required"
  | "chapter-number"
  | "transition-contract"
  | "transaction-pending"
  | "transaction-failed";

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

function validateTransitionMetadata(
  card: Card,
  transition: Transition,
  file: string
): void {
  const { domain, children, status, story_time: storyTime } = card;
  if (domain !== "history")
    throw new CardFailure("transition-contract", file, "专门变迁须为history");
  if (children.length > 0)
    throw new CardFailure("transition-contract", file, "专门变迁没有children");
  if (status === "mixed")
    throw new CardFailure("transition-contract", file, "专门变迁不使用mixed");
  if (transition.mode !== "revision") return;
  if (storyTime !== undefined)
    throw new CardFailure("transition-contract", file, "作者修订不是故事时间");
}
function validateCardMetadata(card: Card, file: string): void {
  if (card.chapter !== undefined && card.domain !== "plot")
    throw new CardFailure("card-contract", file, "chapter仅剧情卡可用");
  const hasTransition = card.transition !== undefined;
  const needsTransition = card.kind === "transition";
  if (hasTransition !== needsTransition)
    throw new CardFailure(
      "transition-contract",
      file,
      "transition字段仅由专门变迁承接且必填"
    );
  const transition = card.transition;
  if (transition === undefined) return;
  validateTransitionMetadata(card, transition, file);
}

export function parseCard(markdown: string, file: string): Card {
  const content = markdown.replace(/^\uFEFF/u, "");
  const frontmatter = parseYamlFrontmatter(content);
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
  validateCardMetadata(card, file);
  if (
    card.domain !== "character" &&
    Object.hasOwn(frontmatter.values, "relations")
  ) {
    throw new CardFailure("card-contract", file, "relations 仅由人物卡承接");
  }
  const body = content
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
    const target = v.safeParse(
      referenceSchema,
      markdown.slice(targetStart, end)
    );
    if (!target.success)
      throw new CardFailure(
        "card-format",
        sourcePath,
        "card: 括号引用必须为精确稳定 ID"
      );
    explicitRefs.push(target.output);
    offset = end + 1;
  }
  const references = [
    ...card.children,
    ...card.sources,
    ...card.refs,
    ...explicitRefs,
    ...card.relations.map((edge) => edge.target),
    ...(card.state_at === undefined ? [] : [card.state_at])
  ];
  const referenceContext =
    area !== "snapshot"
      ? "current"
      : references.some((ref) => !ref.includes("@"))
        ? "snapshot-unqualified-current-not-historical"
        : "snapshot-version-locked";
  return { card, sourcePath, area, markdown, explicitRefs, referenceContext };
}

export function versionKey(card: Card): string {
  return `${card.id}@${card.version}`;
}
export function recordKey(record: CardRecord): string {
  return record.area === "snapshot" ? versionKey(record.card) : record.card.id;
}

export function identityMap(
  records: readonly CardRecord[]
): Map<string, CardRecord> {
  const byId = new Map<string, CardRecord>();
  for (const record of records) {
    const version = versionKey(record.card);
    if (
      byId.has(version) ||
      (record.area !== "snapshot" && byId.has(record.card.id))
    )
      throw new CardFailure(
        "duplicate-id",
        record.sourcePath,
        `重复身份 ${version}`
      );
    byId.set(version, record);
    if (record.area !== "snapshot") byId.set(record.card.id, record);
  }
  return byId;
}

export function requiredTransition(record: CardRecord): Transition {
  if (!record.card.transition)
    throw new CardFailure(
      "transition-contract",
      record.sourcePath,
      "专门变迁必须有transition字段"
    );
  return record.card.transition;
}
