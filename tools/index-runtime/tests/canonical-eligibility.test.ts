import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { syncStateIndex } from "../src/index.ts";
import { prepareStateIndex, syncStateIndexPrepared } from "../src/prepared.ts";
import { preparationFixture } from "./prepared-fixture.ts";
import { withTempRoot } from "./runtime-fixture.ts";
import { resultValue } from "./support.ts";

test("a definition frozen only after build uses the current field order during serialization", async () => {
  await withTempRoot(async (root) => {
    const { definition, snapshot } = preparationFixture();
    const mutable = {
      ...definition,
      fieldOrder: "definition" as const,
      parseState(
        input: Parameters<typeof definition.parseState>[0],
        context: Parameters<typeof definition.parseState>[1]
      ) {
        const state = definition.parseState(input, context);
        return { label: state.label, formedAt: state.formedAt };
      },
      async readRevision() {
        Object.defineProperty(mutable, "fieldOrder", {
          value: "lexicographic"
        });
        Object.freeze(mutable);
        return snapshot.sourceRevision;
      }
    };
    const result = await syncStateIndex({
      context: { root },
      definition: mutable,
      indexPath: "index.json",
      mode: "write"
    });
    assert.equal(result.status, "ok");
    const text = await fs.readFile(path.join(root, "index.json"), "utf8");
    assert.match(text, /"a":\s*\{\s*"formedAt":[^\n]+\n\s*"label":/u);
  });
});

test("prepared index rejects a changed definition frozen after preparation", async () => {
  await withTempRoot(async (root) => {
    const { definition } = preparationFixture();
    const mutable = { ...definition, fieldOrder: "definition" as const };
    const options = {
      context: { root },
      definition: mutable,
      indexPath: "index.json"
    };
    const prepared = resultValue(await prepareStateIndex(options));
    Object.defineProperty(mutable, "fieldOrder", { value: "lexicographic" });
    Object.freeze(mutable);
    const result = await syncStateIndexPrepared({
      ...options,
      prepared,
      mode: "write"
    });
    assert.equal(result.status, "error");
    assert.equal(
      result.diagnostics[0]?.code,
      "state-index.preparation-mismatch"
    );
    await assert.rejects(fs.stat(path.join(root, "index.json")), {
      code: "ENOENT"
    });
  });
});

async function verifyDynamicOrdering(kind: "accessor" | "inherited") {
  await withTempRoot(async (root) => {
    const { definition, snapshot } = preparationFixture();
    let order = "definition";
    const prototype = { fieldOrder: "definition" };
    const values = {
      ...definition,
      parseState(
        input: Parameters<typeof definition.parseState>[0],
        context: Parameters<typeof definition.parseState>[1]
      ) {
        const state = definition.parseState(input, context);
        return { label: state.label, formedAt: state.formedAt };
      },
      async readRevision() {
        order = "lexicographic";
        prototype.fieldOrder = order;
        return snapshot.sourceRevision;
      }
    };
    if (kind === "inherited") Object.setPrototypeOf(values, prototype);
    else
      Object.defineProperty(values, "fieldOrder", {
        get: () => order,
        enumerable: true
      });
    Object.freeze(values);
    const selected = values;
    const result = await syncStateIndex({
      context: { root },
      definition: selected,
      indexPath: "index.json",
      mode: "write"
    });
    assert.equal(result.status, "ok");
    const text = await fs.readFile(path.join(root, "index.json"), "utf8");
    assert.match(text, /"a":\s*\{\s*"formedAt":[^\n]+\n\s*"label":/u);
  });
}

test("frozen accessor definition retains dynamic field-order semantics", async () =>
  await verifyDynamicOrdering("accessor"));
test("frozen inherited definition retains dynamic field-order semantics", async () =>
  await verifyDynamicOrdering("inherited"));
test("frozen proxy definitions avoid additional reflection during sync", async () => {
  await withTempRoot(async (root) => {
    const { definition } = preparationFixture();
    const target = Object.freeze({
      ...definition,
      fieldOrder: "definition" as const
    });
    const proxy = new Proxy(target, {
      getOwnPropertyDescriptor() {
        throw new Error("unexpected proxy reflection");
      }
    });
    const result = await syncStateIndex({
      context: { root },
      definition: proxy,
      indexPath: "index.json",
      mode: "write"
    });
    assert.equal(result.status, "ok");
    assert.ok(
      (await fs.readFile(path.join(root, "index.json"), "utf8")).length > 0
    );
  });
});
