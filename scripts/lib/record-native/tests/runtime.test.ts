import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  rename,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  check,
  ensureRuntimeBase,
  workingSourceDigest
} from "../../../prepare-record-native.ts";
import {
  digest,
  executableName,
  hostTarget,
  preparedRuntime,
  roles
} from "../runtime.ts";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "record-runtime-test-"));
  const source = path.join(root, "tools", "record-cli");
  const generation = path.join(
    root,
    ".local",
    "record-cli",
    "generation-fixture"
  );
  await mkdir(source, { recursive: true });
  await mkdir(generation, { recursive: true });
  await writeFile(path.join(source, "Cargo.toml"), "source\n");
  const bytes = Buffer.from(
    "#!/bin/sh\nprintf '%s\\n' \"$@\"\nprintf 'diagnostic\\n' >&2\nexit 23\n"
  );
  const target = hostTarget();
  for (const role of roles) {
    const file = path.join(generation, executableName(role, target));
    await writeFile(file, bytes);
    if (process.platform !== "win32") await chmod(file, 0o755);
  }
  const receipt = {
    schemaVersion: 1,
    target,
    generation: "generation-fixture",
    sourceHash: await workingSourceDigest(source),
    binaries: {
      "decision-records": digest(bytes),
      "investigation-report": digest(bytes)
    }
  };
  await writeFile(
    path.join(root, ".local", "record-cli", "receipt.json"),
    JSON.stringify(receipt)
  );
  return { root, source, generation };
}
test("check rejects source drift and binary tampering without writing", async () => {
  const f = await fixture();
  try {
    await check(f.root);
    await writeFile(path.join(f.source, "Cargo.toml"), "changed\n");
    await assert.rejects(check(f.root), /source changed/);
    await writeFile(path.join(f.source, "Cargo.toml"), "source\n");
    await writeFile(
      path.join(f.generation, executableName("decision-records", hostTarget())),
      "tampered"
    );
    await assert.rejects(check(f.root), /binary hash mismatch|EACCES/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});
test(
  "dispatcher passes argv, output and exit status; missing runtime fails with prepare instruction",
  { skip: process.platform === "win32" },
  async () => {
    const f = await fixture();
    try {
      await writeFile(path.join(f.root, "package.json"), '{"type":"module"}\n');
      const scripts = path.join(f.root, "scripts");
      await mkdir(path.join(scripts, "lib", "record-native"), {
        recursive: true
      });
      await copyFile(
        new URL("../../../record-native-cli.ts", import.meta.url),
        path.join(scripts, "record-native-cli.ts")
      );
      await copyFile(
        new URL("../runtime.ts", import.meta.url),
        path.join(scripts, "lib", "record-native", "runtime.ts")
      );
      const args = [
        path.join(scripts, "record-native-cli.ts"),
        "decision-records",
        "one space",
        "--json"
      ];
      const result = spawnSync(process.execPath, args, { encoding: "utf8" });
      assert.equal(result.status, 23);
      assert.equal(result.stdout, "one space\n--json\n");
      assert.equal(result.stderr, "diagnostic\n");
      await rm(path.join(f.root, ".local", "record-cli", "receipt.json"));
      const missing = spawnSync(process.execPath, args, { encoding: "utf8" });
      assert.equal(missing.status, 1);
      assert.match(missing.stderr, /bun run prepare:record-native/);
      assert.equal(missing.stdout, "");
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  }
);

test(
  "runtime rejects symlinked receipt and generation before use",
  { skip: process.platform === "win32" },
  async () => {
    const f = await fixture();
    try {
      const receipt = path.join(f.root, ".local/record-cli/receipt.json");
      const savedReceipt = path.join(f.root, "saved-receipt.json");
      await rename(receipt, savedReceipt);
      await symlink(savedReceipt, receipt);
      await assert.rejects(
        preparedRuntime(f.root),
        /invalid runtime receipt file/
      );
      await rm(receipt);
      await rename(savedReceipt, receipt);
      const savedGeneration = path.join(f.root, "saved-generation");
      await rename(f.generation, savedGeneration);
      await symlink(savedGeneration, f.generation);
      await assert.rejects(
        preparedRuntime(f.root),
        /invalid runtime directory/
      );
      await rm(f.generation);
      await rename(savedGeneration, f.generation);
      const savedSource = path.join(f.root, "saved-source");
      await rename(f.source, savedSource);
      await symlink(savedSource, f.source);
      await assert.rejects(check(f.root), /invalid runtime directory/);
    } finally {
      await rm(f.root, { recursive: true, force: true });
    }
  }
);

test(
  "prepare rejects a symlinked local parent before creating its child",
  { skip: process.platform === "win32" },
  async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "runtime-parent-test-"));
    try {
      const outside = path.join(root, "outside");
      await mkdir(outside);
      await symlink(outside, path.join(root, ".local"));
      await assert.rejects(
        ensureRuntimeBase(root),
        /invalid runtime directory/
      );
      assert.deepEqual(
        await import("node:fs/promises").then((fs) => fs.readdir(outside)),
        []
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
);
