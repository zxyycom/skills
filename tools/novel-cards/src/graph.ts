import {
  CardFailure,
  identityMap,
  recordKey,
  type CardRecord,
  type Transition
} from "./card.ts";

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
    card.chapter !== undefined &&
    resolve(card.chapter.scope).card.domain !== "plot"
  )
    throw new CardFailure(
      "chapter-number",
      record.sourcePath,
      "chapter.scope 必须为实际剧情scope对象ID"
    );
  validateTransition(record, resolve);
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

function transitionFailure(record: CardRecord, message: string): never {
  throw new CardFailure("transition-contract", record.sourcePath, message);
}
function validateTransitionEvents(
  record: CardRecord,
  transition: Transition,
  resolve: ResolveCard
): void {
  for (const event of transition.events) {
    const target = resolve(event);
    if (target.card.domain !== "plot")
      transitionFailure(record, "events必须锁定剧情版本");
    if (
      transition.mode === "evolution" &&
      record.card.status === "occurred" &&
      target.card.status !== "occurred"
    )
      transitionFailure(record, "已发生演进不能以预期事件为事实依据");
  }
}

function validateTransitionChanges(
  record: CardRecord,
  transition: Transition,
  resolve: ResolveCard
): void {
  const changed = new Set<string>();
  for (const change of transition.changes) {
    const before = resolve(change.before).card;
    const after = resolve(change.after).card;
    if (
      before.id !== after.id ||
      before.version >= after.version ||
      before.domain !== after.domain ||
      before.kind === "transition" ||
      after.kind === "transition"
    )
      transitionFailure(
        record,
        "变迁端点必须为同对象同域的递增版本，不是变迁记录本身"
      );
    if (changed.has(before.id))
      transitionFailure(record, "每次变迁每个对象只允许一项变化");
    changed.add(before.id);
  }
}

function validateSupersededEvents(
  record: CardRecord,
  transition: Transition,
  resolve: ResolveCard
): void {
  for (const ref of transition.supersedes) {
    const target = resolve(ref);
    if (
      target.card.transition?.mode !== "evolution" ||
      target.card.id === record.card.id
    )
      transitionFailure(record, "supersedes必须为其他故事演进变迁版本");
  }
}

function validateTransition(record: CardRecord, resolve: ResolveCard): void {
  const transition = record.card.transition;
  if (!transition) return;
  for (const refs of [transition.events, transition.supersedes]) {
    if (new Set(refs).size !== refs.length)
      transitionFailure(record, "变迁events/supersedes重复引用");
  }
  if (transition.mode === "evolution") {
    if (transition.events.length === 0)
      transitionFailure(record, "故事演进必须有事件");
    if (transition.supersedes.length > 0)
      transitionFailure(record, "supersedes只由作者修订承接");
  }
  validateTransitionEvents(record, transition, resolve);
  validateTransitionChanges(record, transition, resolve);
  validateSupersededEvents(record, transition, resolve);
}

function requiredCount(
  indegree: ReadonlyMap<string, number>,
  id: string
): number {
  const count = indegree.get(id);
  if (count === undefined)
    throw new CardFailure("missing-reference", "cards", `不存在节点${id}`);
  return count;
}
function requiredRecord(
  byId: ReadonlyMap<string, CardRecord>,
  id: string
): CardRecord {
  const target = byId.get(id);
  if (!target)
    throw new CardFailure("missing-reference", "cards", `不存在节点${id}`);
  return target;
}
function validateContainmentCycles(
  records: readonly CardRecord[],
  byId: ReadonlyMap<string, CardRecord>
): void {
  const indegree = new Map(records.map((record) => [recordKey(record), 0]));
  for (const record of records)
    for (const child of record.card.children) {
      const key = recordKey(requiredRecord(byId, child));
      indegree.set(key, requiredCount(indegree, key) + 1);
    }
  const queue = records.filter(
    (record) => indegree.get(recordKey(record)) === 0
  );
  let visited = 0;
  for (const record of queue) {
    visited += 1;
    for (const child of record.card.children) {
      const target = requiredRecord(byId, child);
      const key = recordKey(target);
      const remaining = requiredCount(indegree, key) - 1;
      indegree.set(key, remaining);
      if (remaining === 0) queue.push(target);
    }
  }
  if (visited !== records.length)
    throw new CardFailure("children-cycle", "cards", "children图含循环");
}

export function validateCards(records: readonly CardRecord[]): void {
  const byId = identityMap(records);
  const chapters = new Set<string>();
  for (const record of records) {
    if (
      (record.area === "transition") !== (record.card.kind === "transition") &&
      record.area !== "snapshot"
    )
      throw new CardFailure(
        "transition-contract",
        record.sourcePath,
        "专门变迁只存history/transitions，普通卡不存变迁区"
      );
    validateReferences(record, byId);
    if (record.card.chapter && record.area !== "snapshot") {
      const key = JSON.stringify([
        record.area,
        record.card.chapter.scope,
        record.card.chapter.number
      ]);
      if (chapters.has(key))
        throw new CardFailure(
          "chapter-number",
          record.sourcePath,
          "同scope章节号重复"
        );
      chapters.add(key);
    }
  }
  validateContainmentCycles(records, byId);
}
