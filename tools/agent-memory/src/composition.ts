import type { Head, Premise, Store } from "./store.ts";

type Visit =
  | { step: "enter"; id: string; expectedGeneration?: number }
  | { step: "leave"; id: string };

/** Current composition metadata within one unchanged transaction state. */
export class Composition {
  readonly #store: Store;
  readonly #heads = new Map<string, Head>();
  readonly #premises = new Map<string, readonly Premise[]>();
  readonly #usable = new Set<string>();

  constructor(store: Store) {
    this.#store = store;
  }

  head(id: string): Head {
    const cached = this.#heads.get(id);
    if (cached !== undefined) return cached;
    const head = this.#store.head(id);
    this.#heads.set(id, head);
    return head;
  }

  blockers(id: string): string[] {
    const blockers = new Set<string>();
    const visiting = new Set<string>();
    const reached = new Set<string>();
    const work: Visit[] = [{ step: "enter", id }];
    let next: Visit | undefined;
    while ((next = work.pop()) !== undefined) {
      if (next.step === "leave") {
        visiting.delete(next.id);
        continue;
      }
      const head = this.head(next.id);
      if (!this.#matches(head, next.expectedGeneration)) blockers.add(next.id);
      if (head.state !== "active" || this.#usable.has(next.id)) continue;
      if (visiting.has(next.id)) blockers.add(next.id);
      if (reached.has(next.id)) continue;
      reached.add(next.id);
      visiting.add(next.id);
      work.push({ step: "leave", id: next.id });
      for (const edge of this.#getPremises(head))
        work.push({
          step: "enter",
          id: edge.target,
          expectedGeneration: edge.target_generation
        });
    }
    if (blockers.size === 0) reached.forEach((key) => this.#usable.add(key));
    return [...blockers].sort();
  }

  #matches(head: Head, expected: number | undefined): boolean {
    return (
      head.state === "active" &&
      (expected === undefined || head.generation === expected)
    );
  }

  #getPremises(head: Head) {
    const cached = this.#premises.get(head.id);
    if (cached !== undefined) return cached;
    const rows = this.#store.premises(head);
    this.#premises.set(head.id, rows);
    return rows;
  }
}
