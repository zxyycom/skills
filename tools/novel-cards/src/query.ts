import { CardFailure, type CardRecord } from "./card.ts";

export function selectCard(
  records: readonly CardRecord[],
  id: string,
  includeReference: boolean
): CardRecord {
  const record = records.find((entry) => entry.card.id === id);
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

  constructor(
    private readonly records: readonly CardRecord[],
    private readonly anchorId: string,
    private readonly limits: ExpansionLimits
  ) {
    this.queue = [{ id: anchorId, level: 0 }];
    this.scheduled = new Set([anchorId]);
  }

  run(): ExpansionResult {
    for (const node of this.queue) this.visit(node);
    const unreadFrontier = this.frontier
      .map((entry) => ({
        ...entry,
        nextIds: entry.nextIds.filter((target) => !this.selected.has(target))
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
    this.selected.set(node.id, record);
    const nextIds = record.card.children.filter(
      (child) => !this.selected.has(child)
    );
    if (nextIds.length === 0) return;
    if (node.level >= this.limits.depth) {
      this.frontier.push({ fromId: node.id, nextIds, reason: "depth" });
      return;
    }
    for (const child of nextIds) this.schedule(child, node.id, node.level + 1);
  }

  private schedule(child: string, fromId: string, level: number): void {
    if (this.scheduled.has(child)) return;
    if (this.scheduled.size >= this.limits.maxCards) {
      this.frontier.push({ fromId, nextIds: [child], reason: "max-cards" });
      return;
    }
    this.scheduled.add(child);
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
