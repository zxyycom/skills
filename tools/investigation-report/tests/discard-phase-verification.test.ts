import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { RecordVerificationPhase } from "../../record-operations/src/transaction-verification.ts";
import {
  withTempRoot,
  investigationRoot,
  reportMarkdown
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";
import { observeSourceReads } from "./phase-verification-support.ts";
import { InvestigationPreparation } from "../src/strict-preparation.ts";
import { publishDiscard } from "../src/discard-publication.ts";
import { collectValidatedInvestigationCollection } from "../src/validation-collection.ts";
import { discardInvestigationReportWithWriter } from "../src/discard.ts";
import { writeInvestigationTextAtomically } from "../src/transaction-files.ts";
async function discardPublicationFixture(workspaceRoot: string) {
  await writeCollection(workspaceRoot, [{ id: "legacy" }, { id: "untouched" }]);
  const root = investigationRoot(workspaceRoot);
  const preparation = new InvestigationPreparation(path.dirname(root), root);
  const collection = await collectValidatedInvestigationCollection(root, {
    preparation
  });
  assert.deepEqual(collection.errors, []);
  const indexPath = path.join(root, "investigation-index.json");
  const originalIndexText = await preparation.read(indexPath);
  // This direct publication fixture keeps the index bytes; it isolates fresh source
  // acquisition and does not claim to exercise the public deletion projection.
  return {
    root,
    preparation,
    collection,
    indexPath,
    originalIndexText,
    options: {
      root,
      preparation,
      indexPath,
      originalIndexText,
      indexText: originalIndexText,
      originalSources: collection.sources,
      reportPath: path.join(root, "legacy.md"),
      resourceOwnerPath: path.join(root, "_resources/legacy"),
      resourceSnapshot: { resourceIds: [], directories: [], errors: [] },
      afterResourceTombstone: async () => {},
      write: writeInvestigationTextAtomically
    }
  };
}

test("Investigation discard fresh collection shares safe source facts with guards but retains independent post collection", async (t) => {
  await withTempRoot("discard-shared-fresh", async (workspaceRoot) => {
    const { root, options } = await discardPublicationFixture(workspaceRoot);
    const unchanged = path.join(root, "untouched.md");
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
          assert.ok(before >= 1, "domain fresh already acquired the source");
          phaseReads.push(counts.get(unchanged)! - before);
        }
      });
      const result = await publishDiscard(options);
      assert.deepEqual(result.errors, []);
      assert.equal(result.changed, true);
      assert.deepEqual(
        phaseReads,
        [0, 1],
        "fresh guards reuse domain observations; shared postwrite reads anew"
      );
    });
  });
});

test("Investigation discard shared fresh rejects source and membership drift without removing the source", async (t) => {
  const original: unknown = Object.getOwnPropertyDescriptor(
    RecordVerificationPhase.prototype,
    "captureTextSnapshots"
  )?.value;
  assert.ok(typeof original === "function");
  const observed = t.mock.method(
    RecordVerificationPhase.prototype,
    "captureTextSnapshots"
  );
  let inject: (() => Promise<void>) | undefined;
  observed.mock.mockImplementation(async function (
    this: RecordVerificationPhase,
    ...args: Parameters<typeof observed>
  ) {
    const action = inject;
    inject = undefined;
    await action?.();
    await Reflect.apply(original, this, args);
  });
  for (const drift of ["source", "membership"] as const)
    await withTempRoot("discard-shared-" + drift, async (workspaceRoot) => {
      const { root, options } = await discardPublicationFixture(workspaceRoot);
      inject = async () => {
        if (drift === "source")
          await fs.appendFile(
            path.join(root, "untouched.md"),
            "\nexternal edit\n"
          );
        else
          await fs.writeFile(
            path.join(root, "external.md"),
            reportMarkdown({ id: "external" })
          );
      };
      const result = await publishDiscard(options);
      assert.equal(result.changed, false);
      assert.ok(result.errors.length > 0);
      assert.match(
        await fs.readFile(path.join(root, "legacy.md"), "utf8"),
        /id: "legacy"/
      );
      if (drift === "source")
        assert.match(
          await fs.readFile(path.join(root, "untouched.md"), "utf8"),
          /external edit/
        );
      else await fs.access(path.join(root, "external.md"));
    });
});

import { synchronizeInvestigationIndex } from "../src/validation.ts";

test("Investigation discard keeps resource byte freshness independent from shared source acquisition", async () => {
  await withTempRoot("discard-shared-resource-drift", async (workspaceRoot) => {
    const root = investigationRoot(workspaceRoot);
    const resource = path.join(root, "_resources/legacy/evidence.txt");
    await writeCollection(
      workspaceRoot,
      [{ id: "legacy", resources: ["legacy/evidence.txt"] }],
      false
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "before");
    assert.deepEqual(
      (await synchronizeInvestigationIndex({ workspaceRoot })).errors,
      []
    );
    const result = await discardInvestigationReportWithWriter(
      { workspaceRoot, id: "legacy", deleteOwnedResources: true },
      writeInvestigationTextAtomically,
      async () => {
        await fs.writeFile(resource, "external resource");
      }
    );
    assert.equal(result.changed, false);
    assert.match(result.errors.join("; "), /Transaction member changed/);
    await fs.access(path.join(root, "legacy.md"));
    assert.equal(await fs.readFile(resource, "utf8"), "external resource");
  });
});
