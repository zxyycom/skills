import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { defineConfig } from "@zxyycom/vibe-check";
import * as v from "valibot";
import { createVibeNativeChecks } from "../../../lib/vibe-gate.ts";
import {
  repositoryRoot,
  runDefinition,
  withTemporaryDirectory
} from "../vibe-check-test-support.ts";

const finding = v.looseObject({
  metric: v.literal("duplicate-tokens"),
  blocking: v.boolean(),
  locations: v.array(
    v.object({ path: v.string(), startLine: v.number(), endLine: v.number() })
  ),
  waiver: v.optional(v.object({ reason: v.string() }))
});

async function write(
  root: string,
  file: string,
  content: string
): Promise<void> {
  const destination = path.join(root, file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content);
}

test("only the reviewed QueryResult duplicate is waived; new duplicates remain blocking", async () => {
  await withTemporaryDirectory("query-result-waiver-", async (root) => {
    const paths = [
      "tools/record-cli/src/queries/decision.rs",
      "tools/record-cli/src/queries/investigation.rs"
    ];
    for (const file of paths)
      await write(
        root,
        file,
        await fs.readFile(path.join(repositoryRoot, file), "utf8")
      );
    const check = createVibeNativeChecks(root).find(
      (item) => item.checkId === "duplicate-detection"
    );
    assert.ok(check);
    const definition = defineConfig({ checks: [check] });
    const reviewed = await runDefinition(definition, root, []);
    assert.equal(reviewed.aggregate, "passed");
    const records = reviewed.snapshot.records.map(({ data }) =>
      v.parse(finding, data)
    );
    assert.equal(records.length, 1);
    assert.deepEqual(records[0]?.locations, [
      { path: paths[0], startLine: 88, endLine: 112 },
      { path: paths[1], startLine: 55, endLine: 79 }
    ]);
    assert.equal(records[0]?.blocking, false);
    assert.ok(records[0]?.waiver?.reason);
    const source =
      Array.from(
        { length: 40 },
        (_, i) =>
          `const fixture_${i} = compute_value(${i}, ${i + 1}, ${i + 2});`
      ).join("\n") + "\n";
    await write(root, "scripts/one.ts", source);
    await write(root, "scripts/two.ts", source);
    const extra = await runDefinition(definition, root, []);
    assert.equal(extra.aggregate, "failed");
    const all = extra.snapshot.records.map(({ data }) =>
      v.parse(finding, data)
    );
    assert.ok(
      all.some(
        (item) =>
          item.blocking &&
          item.locations.some((loc) => loc.path === "scripts/one.ts")
      )
    );
    assert.ok(all.some((item) => !item.blocking && item.waiver));
    const decisionPath = paths[0];
    assert.ok(decisionPath);
    const original = await fs.readFile(path.join(root, decisionPath), "utf8");
    await write(root, decisionPath, `\n${original}`);
    const drifted = await runDefinition(definition, root, []);
    assert.equal(drifted.aggregate, "failed");
    assert.ok(
      drifted.snapshot.records.some(({ data }) => {
        const audit = v.safeParse(
          v.looseObject({
            kind: v.literal("finding-waiver-audit"),
            status: v.literal("unused")
          }),
          data
        );
        return audit.success;
      })
    );
    assert.ok(
      drifted.snapshot.records.some(({ data }) => {
        const item = v.safeParse(finding, data);
        return (
          item.success &&
          item.output.blocking &&
          item.output.locations.some((loc) => loc.path === decisionPath)
        );
      })
    );
  });
});
