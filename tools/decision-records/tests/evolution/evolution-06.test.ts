import { assertLifecycleRejected, evolutionRequest } from "./domain-support.ts";

import { assertEvolutionRejected } from "./domain-support.ts";
import { test } from "./support.ts";

test("evolve rejects a split extension that omits an existing successor before writing", async () => {
  await assertLifecycleRejected(
    [
      { id: "coarse", status: "archived" },
      {
        id: "first",
        status: "active",
        relations: [{ type: "拆分", target: "coarse" }]
      },
      {
        id: "second",
        status: "active",
        relations: [{ type: "拆分", target: "coarse" }]
      },
      { id: "third", relations: [{ type: "拆分", target: "coarse" }] }
    ],
    evolutionRequest(["first", "third"]),
    /selected successor set must equal.*second/
  );
});

test("evolve rejects one selected split successor", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "first", relations: [{ type: "拆分", target: "predecessor" }] }
    ],
    ["first"],
    /requires at least two explicitly selected/u
  );
});

test("evolve rejects mixed split and non-split successor relations", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "first", relations: [{ type: "拆分", target: "predecessor" }] },
      { id: "second", relations: [{ type: "修订", target: "predecessor" }] }
    ],
    ["first", "second"],
    /exactly one 拆分 relation and no other/u
  );
});

test("evolve rejects unsupported multi-successor shapes without split relations", async () => {
  await assertEvolutionRejected(
    [{ id: "first" }, { id: "second" }],
    ["first", "second"],
    /supported only by the closed 拆分 strategy/u
  );
});

test("evolve rejects a pure merge with fewer than two predecessors", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "first", relations: [{ type: "归并", target: "predecessor" }] }
    ],
    ["first"],
    /requires at least two predecessors/u
  );
});
