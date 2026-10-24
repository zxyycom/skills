import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { RecordVerificationPhase } from "../../record-operations/src/transaction-verification.ts";
import { withTempRoot, investigationRoot } from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";
import { observeSourceReads } from "./phase-verification-support.ts";
import { renameInvestigationRecordWithHooks } from "../src/rename.ts";
test("Investigation rename shares hook fresh source and index observations without crossing postwrite phases", async (t) => {
  await withTempRoot("rename-shared-fresh", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "legacy" },
      { id: "untouched" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const unchanged = path.join(root, "legacy.md");
    let freshStarted = false;
    await observeSourceReads([unchanged], async (counts) => {
      const original: unknown = Object.getOwnPropertyDescriptor(
        RecordVerificationPhase.prototype,
        "verifyMany"
      )?.value;
      assert.ok(typeof original === "function");
      const observed = t.mock.method(
        RecordVerificationPhase.prototype,
        "verifyMany"
      );
      const phaseReads: number[] = [];
      observed.mock.mockImplementation(async function (
        this: RecordVerificationPhase,
        ...args: Parameters<typeof observed>
      ) {
        const before = counts.get(unchanged)!;
        await Reflect.apply(original, this, args);
        if (args[0].some((entry) => entry.path === unchanged)) {
          assert.equal(
            freshStarted,
            true,
            "the hook precedes fresh observations"
          );
          phaseReads.push(counts.get(unchanged)! - before);
        }
      });
      const result = await renameInvestigationRecordWithHooks(
        { workspaceRoot, source: "legacy", target: "renamed" },
        {
          beforePublish: async () => {
            freshStarted = true;
          }
        }
      );
      assert.equal(result.status, "ok", result.errors.join("; "));
      assert.ok(phaseReads.length >= 1);
      assert.equal(phaseReads[0], 1);
    });
  });
});

test("Investigation rename fresh aggregation preserves source target and index errors after the hook", async () => {
  await withTempRoot("rename-shared-errors", async (workspaceRoot) => {
    await writeCollection(workspaceRoot, [
      { id: "legacy" },
      { id: "untouched" }
    ]);
    const root = investigationRoot(workspaceRoot);
    const target = path.join(root, "renamed.md");
    const index = path.join(root, "investigation-index.json");
    const result = await renameInvestigationRecordWithHooks(
      { workspaceRoot, source: "legacy", target: "renamed" },
      {
        beforePublish: async () => {
          await fs.appendFile(
            path.join(root, "legacy.md"),
            "\nexternal source edit\n"
          );
          await fs.unlink(path.join(root, "untouched.md"));
          await fs.symlink(
            path.join(root, "legacy.md"),
            path.join(root, "untouched.md")
          );
          await fs.writeFile(target, "external target");
          await fs.appendFile(index, "\nexternal index edit\n");
        }
      }
    );
    assert.equal(result.status, "error");
    assert.equal(result.changed, false);
    const errors = result.errors.join("; ");
    const messages = [
      "legacy changed after rename validation",
      "Investigation rename target path already exists",
      "investigation index changed after rename validation"
    ];
    let cursor = -1;
    for (const message of messages) {
      const index = errors.indexOf(message);
      assert.ok(index > cursor, errors);
      cursor = index;
    }
    assert.equal(await fs.readFile(target, "utf8"), "external target");
    assert.match(await fs.readFile(index, "utf8"), /external index edit/);
  });
});
