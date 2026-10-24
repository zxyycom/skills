import { utcDecisionDate } from "../src/decision-path.ts";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {
  candidateDecisionBody,
  decisionFilePath,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";
import { renameDecisionRecord } from "../src/decision-rename.ts";
import { fixture } from "./support-local-contracts.ts";

const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision candidate create preserves observed sourcePath and fails without readiness when published bytes are replaced", async () => {
  await withTemporaryWorkspace("transaction-new-readback", async (root) => {
    await fixture(root);
    const target = path.join(
      root,
      `docs/decisions/${utcDecisionDate()}-new-proof.md`
    );
    const index = await fs.readFile(indexPath(root));
    const descriptor = Object.getOwnPropertyDescriptor(fs, "link");
    assert.ok(descriptor);
    const link = fs.link.bind(fs);
    Object.defineProperty(fs, "link", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.link>) => {
        await link(...args);
        if (String(args[1]) === target)
          await fs.writeFile(target, "later writer owns this candidate\n");
      }
    });
    try {
      const result = await runSourceCli([
        "new",
        "new-proof",
        "--title",
        "创建后字节验收",
        "--purpose",
        "验证实际创建结果",
        "--background",
        "writer 返回不表示来源已经验收",
        "--decision",
        "保护后来的编辑",
        "--tag",
        "decision-records",
        "--root",
        root
      ]);
      assert.equal(result.exitCode, 1);
      assert.match(result.stdout, /mutation observed/);
      assert.match(result.stdout, /new-proof\.md/);
      assert.doesNotMatch(result.stdout, /scaffoldValid: true|bodyReady:/);
      assert.match(result.stderr, /partial-or-unknown/);
    } finally {
      Object.defineProperty(fs, "link", descriptor);
    }
    assert.equal(
      await fs.readFile(target, "utf8"),
      "later writer owns this candidate\n"
    );
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
  });
});

test("Decision candidate create reports cleanup pending with created path and no success readiness", async () => {
  await withTemporaryWorkspace("transaction-new-cleanup", async (root) => {
    await fixture(root);
    const index = await fs.readFile(indexPath(root));
    const descriptor = Object.getOwnPropertyDescriptor(fs, "unlink");
    assert.ok(descriptor);
    const unlink = fs.unlink.bind(fs);
    Object.defineProperty(fs, "unlink", {
      ...descriptor,
      value: async (...args: Parameters<typeof fs.unlink>) => {
        if (String(args[0]).endsWith(".publish"))
          throw new Error("private staging cleanup blocked");
        return await unlink(...args);
      }
    });
    try {
      const result = await runSourceCli([
        "new",
        "cleanup-proof",
        "--title",
        "创建收尾失败",
        "--purpose",
        "保留实际创建事实",
        "--background",
        "已发布与清理属于不同结果",
        "--decision",
        "精确对账残留",
        "--tag",
        "decision-records",
        "--root",
        root
      ]);
      assert.equal(result.exitCode, 1);
      assert.match(result.stdout, /Created decision candidate scaffold/);
      assert.match(result.stdout, /cleanup-proof\.md/);
      assert.doesNotMatch(result.stdout, /scaffoldValid: true|bodyReady:/);
      assert.match(result.stderr, /committed-cleanup-pending/);
      assert.match(
        result.stderr,
        /object: docs\/\.\d{6}-cleanup-proof\.md\..+\.publish/
      );
    } finally {
      Object.defineProperty(fs, "unlink", descriptor);
    }
    assert.match(
      await fs.readFile(
        path.join(root, `docs/decisions/${utcDecisionDate()}-cleanup-proof.md`),
        "utf8"
      ),
      /status: candidate/
    );
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
  });
});

test("Decision candidate rename and discard preserve existing formal index bytes inode and mode", async () => {
  await withTemporaryWorkspace(
    "candidate-formal-index-representation",
    async (root) => {
      await fixture(root);
      const file = indexPath(root);
      const canonical = await fs.readFile(file, "utf8");
      // Strict full check accepts line-ending normalization, but candidate actions
      // must not publish the LF serialization over these existing CRLF bytes.
      await fs.writeFile(file, canonical.replaceAll("\n", "\r\n"));
      await fs.chmod(file, 0o640);
      const before = await fs.readFile(file);
      const identity = await fs.stat(file);
      const assertIndexPreserved = async () => {
        assert.deepEqual(await fs.readFile(file), before);
        const current = await fs.stat(file);
        assert.equal(current.dev, identity.dev);
        assert.equal(current.ino, identity.ino);
        assert.equal(current.mode, identity.mode);
      };
      const id = "261023-candidate-before";
      await writeDecision(root, id, candidateDecisionBody({ id }));
      const reference = "261023-zz-reference";
      await writeDecision(
        root,
        reference,
        candidateDecisionBody({
          id: reference,
          relations: [{ type: "修订", target: id }]
        })
      );
      const originalPath = decisionFilePath(root, id);
      const renamed = await renameDecisionRecord({
        workspaceRoot: root,
        source: id,
        target: "candidate-after"
      });
      assert.equal(renamed.status, "ok", JSON.stringify(renamed));
      if (renamed.status !== "ok")
        throw new Error("Expected candidate rename success");
      assert.equal(renamed.changed, true);
      await assert.rejects(fs.access(originalPath));
      const renamedPath = path.join(
        root,
        "docs/decisions",
        renamed.plan.newSourcePath
      );
      assert.match(
        await fs.readFile(renamedPath, "utf8"),
        /id: 261023-candidate-after/
      );
      assert.match(
        await fs.readFile(decisionFilePath(root, reference), "utf8"),
        /target: 261023-candidate-before/
      );
      await fs.unlink(decisionFilePath(root, reference));
      await assertIndexPreserved();
      const discarded = await runSourceCli([
        "discard",
        renamed.plan.newId,
        "--root",
        root
      ]);
      assert.equal(discarded.exitCode, 0, discarded.stderr);
      await assert.rejects(fs.access(renamedPath));
      await assertIndexPreserved();
    }
  );
});
