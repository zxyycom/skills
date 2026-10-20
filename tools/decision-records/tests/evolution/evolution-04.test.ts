import test from "node:test";
import { assertEvolutionRejected } from "./domain-support.ts";

test("evolve rejects a one-predecessor reallocation", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "first", relations: [{ type: "重划", target: "predecessor" }] },
      { id: "second", relations: [{ type: "重划", target: "predecessor" }] }
    ],
    ["first", "second"],
    /requires at least two distinct predecessors/u
  );
});

test("evolve rejects mixed reallocation and other successor relations", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "another", status: "active" },
      {
        id: "first",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "修订", target: "another" }
        ]
      },
      {
        id: "second",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      }
    ],
    ["first", "second"],
    /at least one 重划 relation and no other/u
  );
});

test("evolve rejects a disconnected reallocation graph", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "active" },
      { id: "another", status: "active" },
      { id: "first", relations: [{ type: "重划", target: "predecessor" }] },
      { id: "second", relations: [{ type: "重划", target: "another" }] }
    ],
    ["first", "second"],
    /successor-predecessor graph must be connected/u
  );
});

test("evolve rejects a reallocation that overlaps successor and predecessor roles", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "archived" },
      { id: "another", status: "archived" },
      {
        id: "first",
        status: "active",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      },
      {
        id: "second",
        status: "active",
        relations: [{ type: "重划", target: "predecessor" }]
      },
      {
        id: "overlapping",
        relations: [
          { type: "重划", target: "first" },
          { type: "重划", target: "predecessor" }
        ]
      }
    ],
    ["first", "overlapping"],
    /both successor and predecessor/u
  );
});

test("evolve requires every established successor in a reallocation component", async () => {
  await assertEvolutionRejected(
    [
      { id: "predecessor", status: "archived" },
      { id: "another", status: "archived" },
      {
        id: "first",
        status: "active",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      },
      {
        id: "second",
        status: "active",
        relations: [{ type: "重划", target: "predecessor" }]
      },
      {
        id: "use-third-reallocation-successor",
        status: "active",
        relations: [
          { type: "重划", target: "predecessor" },
          { type: "重划", target: "another" }
        ]
      }
    ],
    ["first", "second"],
    /equal every final 重划 successor.*use-third-reallocation-successor/u
  );
});
