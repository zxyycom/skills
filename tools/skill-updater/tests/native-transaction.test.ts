import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { activateLegacyBundle } from "../src/native/legacy-transaction.ts";
import { resumeLegacyCleanup } from "../src/native/legacy-resume.ts";

const oldSkill =
  '---\nname: decision-records\nmetadata:\n  version: "109"\n---\n';
const newSkill =
  '---\nname: decision-records\nmetadata:\n  version: "110"\n---\n';
const legacy = {
  version: 109,
  files: {
    "SKILL.md": {
      byteLength: 58,
      sha256: "10963513591115589eb4e5af2a8f785244b9eb154d4cd08bb48dbe77a453db74"
    },
    "old.ts": {
      byteLength: 3,
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    }
  }
};
const files = [
  { path: "SKILL.md", data: Buffer.from(newSkill) },
  { path: "native-runtime.json", data: Buffer.from("{}") },
  { path: "bin/decision-records", data: Buffer.from("private fixture") }
];
async function fixture() {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "native-transaction-")
  );
  const target = path.join(parent, "decision-records");
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "SKILL.md"), oldSkill);
  await fs.writeFile(path.join(target, "old.ts"), "abc");
  await fs.writeFile(path.join(target, "custom"), "keep");
  return { parent, target };
}
function options(
  target: string,
  validatePrepared: (target: string) => Promise<void>
) {
  return {
    target,
    role: "decision-records",
    legacy,
    files,
    runtimeVersion: "0.1.0",
    sourceHash: "a".repeat(64),
    confirm: async () => true,
    validatePrepared
  };
}

test("legacy activation restores old files when validation fails before entry switch", async () => {
  const { parent, target } = await fixture();
  const oldMode = (await fs.stat(path.join(target, "SKILL.md"))).mode & 0o777;
  try {
    await assert.rejects(
      activateLegacyBundle(
        options(target, async () => {
          throw new Error("fixture validation failure");
        })
      ),
      /changes restored/
    );
    assert.equal(
      await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
      oldSkill
    );
    assert.equal(
      (await fs.stat(path.join(target, "SKILL.md"))).mode & 0o777,
      oldMode
    );
    assert.equal(await fs.readFile(path.join(target, "old.ts"), "utf8"), "abc");
    assert.equal(
      await fs.readFile(path.join(target, "custom"), "utf8"),
      "keep"
    );
    await assert.rejects(
      fs.lstat(path.join(target, ".record-native-receipt.json")),
      { code: "ENOENT" }
    );
    await assert.rejects(fs.lstat(path.join(target, "bin/decision-records")), {
      code: "ENOENT"
    });
    assert.deepEqual(await fs.readdir(parent), ["decision-records"]);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("legacy activation enables entry last and retires only verified old files", async () => {
  const { parent, target } = await fixture();
  try {
    await activateLegacyBundle(
      options(target, async (root) => {
        assert.equal(
          await fs.readFile(path.join(root, "SKILL.md"), "utf8"),
          oldSkill
        );
        assert.equal(
          await fs.readFile(path.join(root, "bin/decision-records"), "utf8"),
          "private fixture"
        );
      })
    );
    assert.equal(
      await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
      newSkill
    );
    assert.equal(
      await fs.readFile(path.join(target, "custom"), "utf8"),
      "keep"
    );
    await assert.rejects(fs.lstat(path.join(target, "old.ts")), {
      code: "ENOENT"
    });
    const receipt = JSON.parse(
      await fs.readFile(
        path.join(target, ".record-native-receipt.json"),
        "utf8"
      )
    );
    assert.equal(receipt.state, "complete");
    assert.deepEqual(await fs.readdir(parent), ["decision-records"]);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("legacy activation reports cleanup pending without deleting changed old files", async () => {
  const { parent, target } = await fixture();
  try {
    await assert.rejects(
      activateLegacyBundle(
        options(target, async (root) => {
          await fs.writeFile(path.join(root, "old.ts"), "changed");
        })
      ),
      /activated; cleanup pending/
    );
    assert.equal(
      await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
      newSkill
    );
    assert.equal(
      await fs.readFile(path.join(target, "old.ts"), "utf8"),
      "changed"
    );
    assert.equal(
      await fs.readFile(path.join(target, "custom"), "utf8"),
      "keep"
    );
    const receipt = JSON.parse(
      await fs.readFile(
        path.join(target, ".record-native-receipt.json"),
        "utf8"
      )
    );
    assert.equal(receipt.state, "cleanup-pending");
    assert.ok(
      receipt.files.every(
        (file: { mode: unknown }) => typeof file.mode === "number"
      )
    );
    assert.ok((await fs.stat(receipt.backup)).isDirectory());
    const retry = options(target, async (root) => {
      assert.equal(
        await fs.readFile(path.join(root, "SKILL.md"), "utf8"),
        newSkill
      );
    });
    await assert.rejects(resumeLegacyCleanup(retry), /retired file changed/);
    assert.equal(
      await fs.readFile(path.join(target, "old.ts"), "utf8"),
      "changed"
    );
    await fs.writeFile(path.join(target, "old.ts"), "abc");
    if (process.platform !== "win32") {
      const descriptor = path.join(target, "native-runtime.json");
      const mode = receipt.files.find(
        (file: { path: string }) => file.path === "native-runtime.json"
      ).mode;
      await fs.chmod(descriptor, mode ^ 0o002);
      await assert.rejects(resumeLegacyCleanup(retry), /mode differs/);
      const receiptFile = path.join(target, ".record-native-receipt.json");
      const originalReceipt = await fs.readFile(receiptFile);
      const modified = JSON.parse(originalReceipt.toString("utf8"));
      modified.files.find(
        (file: { path: string }) => file.path === "native-runtime.json"
      ).mode = mode ^ 0o002;
      await fs.writeFile(receiptFile, `${JSON.stringify(modified, null, 2)}\n`);
      await assert.rejects(
        resumeLegacyCleanup(retry),
        /mode violates platform policy/
      );
      await fs.writeFile(receiptFile, originalReceipt);
      await fs.chmod(descriptor, mode);
    }
    const unknown = path.join(receipt.backup, "user-note");
    await fs.writeFile(unknown, "keep");
    await assert.rejects(
      resumeLegacyCleanup(retry),
      /unrecognized recovery file/
    );
    assert.equal(await fs.readFile(unknown, "utf8"), "keep");
    assert.equal(await fs.readFile(path.join(target, "old.ts"), "utf8"), "abc");
    await fs.unlink(unknown);
    const backup = path.join(receipt.backup, "backup-3");
    await fs.writeFile(backup, "tampered");
    await assert.rejects(resumeLegacyCleanup(retry), /changed recovery file/);
    assert.equal(await fs.readFile(path.join(target, "old.ts"), "utf8"), "abc");
    await fs.writeFile(backup, oldSkill);
    await resumeLegacyCleanup(retry);
    await assert.rejects(fs.lstat(path.join(target, "old.ts")), {
      code: "ENOENT"
    });
    await assert.rejects(fs.lstat(receipt.backup), { code: "ENOENT" });
    assert.equal(
      JSON.parse(
        await fs.readFile(
          path.join(target, ".record-native-receipt.json"),
          "utf8"
        )
      ).state,
      "complete"
    );
    await resumeLegacyCleanup(retry);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("legacy activation refuses same version and declined confirmation before writing", async () => {
  const { parent, target } = await fixture();
  try {
    const input = options(target, async () => {});
    const same = files.map((file) =>
      file.path === "SKILL.md" ? { ...file, data: Buffer.from(oldSkill) } : file
    );
    await assert.rejects(
      activateLegacyBundle({ ...input, files: same }),
      /must be newer/
    );
    await assert.rejects(
      activateLegacyBundle({ ...input, confirm: async () => false }),
      /cancelled before writes/
    );
    assert.equal(
      await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
      oldSkill
    );
    assert.deepEqual((await fs.readdir(target)).sort(), [
      "SKILL.md",
      "custom",
      "old.ts"
    ]);
    assert.deepEqual(await fs.readdir(parent), ["decision-records"]);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("legacy rollback preserves concurrent changes and retains recovery evidence", async () => {
  const { parent, target } = await fixture();
  try {
    await assert.rejects(
      activateLegacyBundle(
        options(target, async (root) => {
          await fs.writeFile(
            path.join(root, "bin/decision-records"),
            "external change"
          );
          throw new Error("fixture validation failure");
        })
      ),
      /recovery incomplete/
    );
    assert.equal(
      await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
      oldSkill
    );
    assert.equal(
      await fs.readFile(path.join(target, "bin/decision-records"), "utf8"),
      "external change"
    );
    assert.equal(await fs.readFile(path.join(target, "old.ts"), "utf8"), "abc");
    assert.equal(
      await fs.readFile(path.join(target, "custom"), "utf8"),
      "keep"
    );
    assert.ok(
      (await fs.readdir(parent)).some((name) =>
        name.startsWith(".decision-records.native-")
      )
    );
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});
