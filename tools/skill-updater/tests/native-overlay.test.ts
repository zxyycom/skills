import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applyOverlay, planOverlay } from "../src/native/overlay.ts";

const entry = { path: "SKILL.md", data: Buffer.from("new entry") };

test("native overlay restores replaced bytes and mode on validation failure", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-restore-"));
  try {
    const old = path.join(root, "file");
    await fs.writeFile(old, "original");
    await fs.chmod(old, 0o640);
    const mode = (await fs.stat(old)).mode & 0o777;
    await fs.writeFile(path.join(root, "SKILL.md"), "old entry");
    const files = [
      { path: "file", data: Buffer.from("replacement") },
      { path: "bin/tool", data: Buffer.from("new") },
      entry
    ];
    await assert.rejects(
      applyOverlay(root, files, async () => {
        throw new Error("validation failure");
      }),
      /validation failure/
    );
    assert.equal(await fs.readFile(old, "utf8"), "original");
    assert.equal((await fs.stat(old)).mode & 0o777, mode);
    assert.equal(
      await fs.readFile(path.join(root, "SKILL.md"), "utf8"),
      "old entry"
    );
    await assert.rejects(fs.lstat(path.join(root, "bin/tool")), {
      code: "ENOENT"
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("native overlay validates before enabling entry and preserves unrelated files", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-success-"));
  try {
    await fs.writeFile(path.join(root, "SKILL.md"), "old entry");
    await fs.writeFile(path.join(root, "sentinel"), "keep");
    await applyOverlay(
      root,
      [{ path: "bin/tool", data: Buffer.from("program") }, entry],
      async () => {
        assert.equal(
          await fs.readFile(path.join(root, "SKILL.md"), "utf8"),
          "old entry"
        );
        assert.equal(
          await fs.readFile(path.join(root, "bin/tool"), "utf8"),
          "program"
        );
      }
    );
    assert.equal(
      await fs.readFile(path.join(root, "SKILL.md"), "utf8"),
      "new entry"
    );
    assert.equal(
      await fs.readFile(path.join(root, "sentinel"), "utf8"),
      "keep"
    );
    if (process.platform !== "win32")
      assert.ok((await fs.stat(path.join(root, "bin/tool"))).mode & 0o111);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("native rollback retains original backup when a written file changes", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-conflict-"));
  const root = path.join(parent, "skill");
  try {
    await fs.mkdir(root);
    await fs.writeFile(path.join(root, "file"), "original");
    let message = "";
    await assert.rejects(
      applyOverlay(
        root,
        [{ path: "file", data: Buffer.from("new") }, entry],
        async () => {
          await fs.writeFile(path.join(root, "file"), "changed");
          throw new Error("failure");
        }
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        message = error.message;
        return /rollback incomplete/.test(message);
      }
    );
    const backup = /backup: ([^)]+)\)/.exec(message)?.[1];
    assert.ok(backup);
    assert.equal(await fs.readFile(backup, "utf8"), "original");
    assert.equal(await fs.readFile(path.join(root, "file"), "utf8"), "changed");
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("native rollback retains original backup after restore readback failure", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-readback-"));
  const root = path.join(parent, "skill");
  const target = path.join(root, "file");
  const readFile = fs.readFile;
  let armed = false;
  let failures = 0;
  try {
    await fs.mkdir(root);
    await fs.writeFile(target, "original");
    fs.readFile = new Proxy(readFile, {
      async apply(fn, receiver, args) {
        const result: unknown = await Reflect.apply(fn, receiver, args);
        if (
          armed &&
          String(args[0]) === target &&
          Buffer.isBuffer(result) &&
          result.toString() === "original" &&
          failures === 0
        ) {
          failures++;
          throw Object.assign(new Error("injected readback EIO"), {
            code: "EIO"
          });
        }
        return result;
      }
    });
    let message = "";
    await assert.rejects(
      applyOverlay(
        root,
        [{ path: "file", data: Buffer.from("new") }, entry],
        async () => {
          armed = true;
          throw new Error("validation failure");
        }
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        message = error.message;
        return /readback EIO/.test(message);
      }
    );
    assert.equal(failures, 1);
    fs.readFile = readFile;
    const backup = /backup: ([^)]+)\)/.exec(message)?.[1];
    assert.ok(backup);
    assert.equal(await fs.readFile(backup, "utf8"), "original");
  } finally {
    fs.readFile = readFile;
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("native update reports primary failure and retained stage when cleanup fails", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-cleanup-"));
  const root = path.join(parent, "skill");
  const rm = fs.rm;
  try {
    await fs.mkdir(root);
    let rejectedPath = "";
    fs.rm = async (target, options) => {
      const candidate = path.resolve(String(target));
      if (
        path.dirname(candidate) === parent &&
        candidate !== root &&
        (await fs.lstat(candidate)).isDirectory()
      ) {
        rejectedPath = candidate;
        throw new Error("cleanup denied");
      }
      await rm(target, options);
    };
    let message = "";
    await assert.rejects(
      applyOverlay(root, [entry], async () => {
        throw new Error("validation failure");
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        message = error.message;
        return /validation failure.*rollback complete.*cleanup incomplete.*cleanup denied/.test(
          message
        );
      }
    );
    assert.ok(rejectedPath);
    assert.ok(message.includes(rejectedPath));
    assert.ok((await fs.stat(rejectedPath)).isDirectory());
  } finally {
    fs.rm = rm;
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("native update distinguishes installed files from stage cleanup failure", async () => {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), "overlay-cleanup-success-")
  );
  const root = path.join(parent, "skill");
  const rm = fs.rm;
  try {
    await fs.mkdir(root);
    let rejectedPath = "";
    fs.rm = async (target, options) => {
      const candidate = path.resolve(String(target));
      if (
        path.dirname(candidate) === parent &&
        candidate !== root &&
        (await fs.lstat(candidate)).isDirectory()
      ) {
        rejectedPath = candidate;
        throw new Error("cleanup denied");
      }
      await rm(target, options);
    };
    await assert.rejects(
      applyOverlay(root, [entry], async () => {}),
      /installed; temporary cleanup incomplete:.*cleanup denied/
    );
    assert.equal(
      await fs.readFile(path.join(root, "SKILL.md"), "utf8"),
      "new entry"
    );
    assert.ok(rejectedPath);
    assert.ok((await fs.stat(rejectedPath)).isDirectory());
  } finally {
    fs.rm = rm;
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test("nested native target is read-only and removes created directories after failure", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-nested-"));
  const root = path.join(parent, ".codex", "skills", "role");
  try {
    assert.deepEqual(await planOverlay(root, [entry]), {
      add: ["SKILL.md"],
      replace: []
    });
    assert.deepEqual(await fs.readdir(parent), []);
    await assert.rejects(
      applyOverlay(root, [entry], async () => {
        throw new Error("validation failure");
      }),
      /validation failure/
    );
    assert.deepEqual(await fs.readdir(parent), []);
  } finally {
    await fs.rm(parent, { recursive: true, force: true });
  }
});

test(
  "native target rejects linked ancestors without creating external files",
  { skip: process.platform === "win32" },
  async () => {
    const parent = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-link-"));
    const external = await fs.mkdtemp(
      path.join(os.tmpdir(), "overlay-external-")
    );
    try {
      await fs.symlink(external, path.join(parent, ".codex"));
      const root = path.join(parent, ".codex", "skills", "role");
      await assert.rejects(
        planOverlay(root, [entry]),
        /unsafe native directory/
      );
      await assert.rejects(
        applyOverlay(root, [entry], async () => {}),
        /unsafe native directory/
      );
      assert.deepEqual(await fs.readdir(external), []);
    } finally {
      await fs.rm(parent, { recursive: true, force: true });
      await fs.rm(external, { recursive: true, force: true });
    }
  }
);

test("native failure reports created directory cleanup errors", async () => {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "overlay-rmdir-"));
  const root = path.join(parent, "nested", "role");
  const rmdir = fs.rmdir;
  try {
    fs.rmdir = async (target) => {
      if (String(target) === root) throw new Error("directory cleanup denied");
      await rmdir(target);
    };
    await assert.rejects(
      applyOverlay(root, [entry], async () => {
        throw new Error("validation failure");
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /validation failure.*cleanup incomplete/);
        assert.ok(error.message.includes(root));
        assert.match(error.message, /directory cleanup denied/);
        return true;
      }
    );
    assert.ok((await fs.stat(root)).isDirectory());
  } finally {
    fs.rmdir = rmdir;
    await fs.rm(parent, { recursive: true, force: true });
  }
});
