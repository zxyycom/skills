import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { RecordVerificationPhase } from "../../../../record-operations/src/transactions/transaction-verification.ts";
import { withTempRoot } from "../../support/fixture-support.ts";
import {
  createResourceMoveProgress,
  prepareResourceSourceProof,
  verifyResourceSourceProof
} from "../../../src/rename/resources/rename-resource-proof.ts";
test("Investigation fresh resource phase rejects wrong roots even without files and preserves binary file and directory facts", async () => {
  await withTempRoot("resource-shared-fresh", async (root) => {
    const owner = path.join(root, "owner");
    await fs.mkdir(path.join(owner, "empty"), { recursive: true });
    const resource = path.join(owner, "evidence.bin");
    await fs.writeFile(resource, Buffer.from([0xff, 0x00]));
    const progress = await prepareResourceSourceProof({
      root,
      owner,
      files: [{ path: "evidence.bin" }],
      directories: ["", "empty"]
    });
    const wrong = new RecordVerificationPhase(path.dirname(root));
    for (const protectedRange of [
      progress,
      { ...progress, sourceFiles: new Map() },
      createResourceMoveProgress()
    ])
      await assert.rejects(
        verifyResourceSourceProof(root, owner, protectedRange, wrong),
        /root does not match/
      );
    const phase = new RecordVerificationPhase(root);
    await verifyResourceSourceProof(root, owner, progress, phase);
    const before = progress.sourceFiles.get("evidence.bin")!;
    await fs.chmod(resource, before.mode ^ 0o100);
    await assert.rejects(
      verifyResourceSourceProof(
        root,
        owner,
        progress,
        new RecordVerificationPhase(root)
      ),
      /Transaction member changed/
    );
    await fs.chmod(resource, before.mode);
    await fs.chmod(
      path.join(owner, "empty"),
      progress.sourceDirectories.get("empty")!.mode ^ 0o100
    );
    await assert.rejects(
      verifyResourceSourceProof(
        root,
        owner,
        progress,
        new RecordVerificationPhase(root)
      ),
      /Resource directory identity\/mode changed/
    );
    // No phase means an independent lifecycle check, even if the earlier phase passed.
    await fs.writeFile(resource, "external bytes");
    await assert.rejects(
      verifyResourceSourceProof(root, owner, progress),
      /Transaction member changed/
    );
    assert.equal(await fs.readFile(resource, "utf8"), "external bytes");
  });
});

test("Investigation resource preparation preserves ordered binary snapshots and first missing or mode failure", async () => {
  await withTempRoot("resource-prepare-batch", async (root) => {
    const owner = path.join(root, "owner");
    await fs.mkdir(owner);
    await fs.writeFile(path.join(owner, "a.bin"), Buffer.from([0xff]));
    await fs.writeFile(path.join(owner, "b.bin"), Buffer.from([0x00]));
    const mode = (await fs.stat(path.join(owner, "a.bin"))).mode & 0o7777;
    const prepared = await prepareResourceSourceProof({
      root,
      owner,
      files: [{ path: "b.bin" }, { path: "a.bin", mode }],
      directories: [""]
    });
    assert.deepEqual([...prepared.sourceFiles.keys()], ["b.bin", "a.bin"]);
    assert.deepEqual(
      Buffer.from(prepared.sourceFiles.get("a.bin")!.bytes),
      Buffer.from([0xff])
    );
    assert.equal(prepared.sourceFiles.get("a.bin")!.mode, mode);
    assert.ok(prepared.sourceDirectories.has(""));
    for (const files of [
      [{ path: "missing.bin" }, { path: "a.bin", mode: mode ^ 0o100 }],
      [{ path: "a.bin", mode: mode ^ 0o100 }, { path: "missing.bin" }]
    ])
      await assert.rejects(
        prepareResourceSourceProof({
          root,
          owner,
          files,
          directories: ["not-reached"]
        }),
        new RegExp(
          "Prepared resource file disappeared or changed mode: " +
            files[0]!.path.replace(".", "\\.")
        )
      );
  });
});
