import {
  CardFailure,
  identityMap,
  versionKey,
  requiredTransition,
  type Card,
  type Transition,
  type CardRecord
} from "./card.ts";

export function selectCard(
  records: readonly CardRecord[],
  id: string,
  includeReference: boolean
): CardRecord {
  const record = identityMap(records).get(id);
  if (!record)
    throw new CardFailure(
      "card-not-found",
      "",
      `不存在的卡片 ID：${id}（仅精确 ID，不接受路径）`
    );
  if (record.area === "reference" && !includeReference)
    throw new CardFailure(
      "reference-read-required",
      record.sourcePath,
      "读取参考内容需显式 --include-reference；参考不自动成为当前规划"
    );
  return record;
}

type Frontier = Readonly<{
  fromId: string;
  nextIds: readonly string[];
  reason: "depth" | "max-cards";
}>;
export type ExpansionLimits = Readonly<{
  depth: number;
  maxCards: number;
  includeReference: boolean;
}>;
export type ExpansionResult = Readonly<{
  anchorId: string;
  complete: boolean;
  depth: number;
  maxCards: number;
  frontier: readonly Frontier[];
  cards: readonly CardRecord[];
}>;
type QueuedCard = Readonly<{ id: string; level: number }>;

class Expansion {
  private readonly selected = new Map<string, CardRecord>();
  private readonly frontier: Frontier[] = [];
  private readonly queue: QueuedCard[];
  private readonly scheduled: Set<string>;
  private readonly byId: ReadonlyMap<string, CardRecord>;

  constructor(
    private readonly records: readonly CardRecord[],
    private readonly anchorId: string,
    private readonly limits: ExpansionLimits
  ) {
    this.byId = identityMap(records);
    const anchor = selectCard(records, anchorId, limits.includeReference);
    this.queue = [{ id: anchorId, level: 0 }];
    this.scheduled = new Set([versionKey(anchor.card)]);
  }

  run(): ExpansionResult {
    for (const node of this.queue) this.visit(node);
    const unreadFrontier = this.frontier
      .map((entry) => ({
        ...entry,
        nextIds: entry.nextIds.filter((target) => !this.returned(target))
      }))
      .filter((entry) => entry.nextIds.length > 0);
    return {
      anchorId: this.anchorId,
      complete: unreadFrontier.length === 0,
      depth: this.limits.depth,
      maxCards: this.limits.maxCards,
      frontier: unreadFrontier,
      cards: [...this.selected.values()]
    };
  }

  private visit(node: QueuedCard): void {
    const record = selectCard(
      this.records,
      node.id,
      this.limits.includeReference
    );
    if (
      record.area === "snapshot" &&
      record.card.children.some((ref) => !ref.includes("@"))
    )
      throw new CardFailure(
        "card-contract",
        record.sourcePath,
        "旧快照children未锁版本，不能证明历史闭包；请分别读取明确版本"
      );
    this.selected.set(versionKey(record.card), record);
    const nextIds = record.card.children.filter(
      (child) => !this.returned(child)
    );
    if (nextIds.length === 0) return;
    if (node.level >= this.limits.depth) {
      this.frontier.push({ fromId: node.id, nextIds, reason: "depth" });
      return;
    }
    for (const child of nextIds) this.schedule(child, node.id, node.level + 1);
  }

  private versionIdentity(id: string): string {
    const record = this.byId.get(id);
    if (!record)
      throw new CardFailure("missing-reference", "cards", `不存在卡片${id}`);
    return versionKey(record.card);
  }
  private returned(id: string): boolean {
    return this.selected.has(this.versionIdentity(id));
  }

  private schedule(child: string, fromId: string, level: number): void {
    const key = this.versionIdentity(child);
    if (this.scheduled.has(key)) return;
    if (this.scheduled.size >= this.limits.maxCards) {
      this.frontier.push({ fromId, nextIds: [child], reason: "max-cards" });
      return;
    }
    this.scheduled.add(key);
    this.queue.push({ id: child, level });
  }
}

export function expandCards(
  records: readonly CardRecord[],
  id: string,
  limits: ExpansionLimits
): ExpansionResult {
  return new Expansion(records, id, limits).run();
}

export type CardSelector =
  | Readonly<{
      title: string;
      chapter?: never;
      scope?: never;
      includeReference: boolean;
    }>
  | Readonly<{
      title?: never;
      chapter: number;
      scope?: string;
      includeReference: boolean;
    }>;
export type CardCandidate = Readonly<
  Pick<Card, "id" | "version" | "title" | "chapter"> &
    Pick<CardRecord, "area" | "sourcePath"> & { scopeTitle?: string }
>;
export type FindResult = Readonly<{
  candidates: readonly CardCandidate[];
  ambiguous: boolean;
}>;
export type HistoryTransition = Readonly<
  Transition &
    Pick<Card, "id" | "version" | "title" | "status"> &
    Pick<CardRecord, "sourcePath">
>;
export type HistoryResult = Readonly<{
  anchorId: string;
  transitions: readonly HistoryTransition[];
  excluded: readonly string[];
}>;
function scopeTitle(
  record: CardRecord,
  byId: ReadonlyMap<string, CardRecord>
): string | undefined {
  const chapter = record.card.chapter;
  if (chapter === undefined) return undefined;
  const scope = byId.get(chapter.scope);
  if (!scope)
    throw new CardFailure(
      "missing-reference",
      record.sourcePath,
      `不存在scope ${chapter.scope}`
    );
  return scope.card.title;
}
export function findCards(
  records: readonly CardRecord[],
  selector: CardSelector
): FindResult {
  const byId = identityMap(records);
  const candidates = records
    .filter(
      (record) =>
        record.area !== "snapshot" &&
        record.area !== "transition" &&
        (record.area !== "reference" || selector.includeReference) &&
        (selector.title === undefined ||
          record.card.title === selector.title) &&
        (selector.chapter === undefined ||
          record.card.chapter?.number === selector.chapter) &&
        (selector.scope === undefined ||
          record.card.chapter?.scope === selector.scope)
    )
    .map((record) => ({
      id: record.card.id,
      version: record.card.version,
      title: record.card.title,
      chapter: record.card.chapter,
      scopeTitle: scopeTitle(record, byId),
      area: record.area,
      sourcePath: record.sourcePath
    }));
  return { candidates, ambiguous: candidates.length > 1 };
}
function isActiveTransition(record: CardRecord): boolean {
  if (record.area !== "transition") return false;
  return requiredTransition(record).lifecycle === "active";
}
function effectiveSupersedes(record: CardRecord): readonly string[] {
  if (record.card.status !== "occurred") return [];
  return requiredTransition(record).supersedes;
}
function relatedTransition(record: CardRecord, id: string): boolean {
  if (record.card.id === id) return true;
  if (versionKey(record.card) === id) return true;
  const data = requiredTransition(record);
  const refs = [
    ...data.events,
    ...data.changes.flatMap((change) => [change.before, change.after])
  ];
  return refs.some((ref) =>
    id.includes("@") ? ref === id : ref.startsWith(`${id}@`)
  );
}
export function historyFor(
  records: readonly CardRecord[],
  id: string,
  includeReference: boolean
): HistoryResult {
  selectCard(records, id, includeReference);
  const current = records.filter(isActiveTransition);
  const excluded = new Set(current.flatMap(effectiveSupersedes));
  const eligible = current.filter(
    (record) => !excluded.has(versionKey(record.card))
  );
  const transitions = eligible
    .filter((record) => relatedTransition(record, id))
    .map((record) => ({
      id: record.card.id,
      version: record.card.version,
      title: record.card.title,
      status: record.card.status,
      ...requiredTransition(record),
      sourcePath: record.sourcePath
    }));
  return { anchorId: id, transitions, excluded: [...excluded] };
}
