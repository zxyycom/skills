import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { planNativeHandoff } from "../src/native/native-plan.ts";
import { strToU8, zipSync } from "fflate";
import {
  prepareBundleWithEvidence,
  verifyInstalledNativeEvidence
} from "../src/native/installed-evidence.ts";

test("installed release evidence and current files jointly prove native ownership", async () => {
  const role = "decision-records";
  const target = "x86_64-unknown-linux-gnu";
  const hash = "a".repeat(64);
  const descriptor = {
    schemaVersion: 1,
    role,
    runtimeVersion: "0.1.0",
    sourceHash: hash,
    targets: [target, "x86_64-pc-windows-msvc"]
  };
  const packageZip = zipSync(
    Object.fromEntries(
      Object.entries({
        "SKILL.md":
          '---\nname: decision-records\nmetadata:\n  version: "110"\n---\n',
        "native-runtime.json": JSON.stringify(descriptor),
        "references/decision-index.schema.json": "{}",
        "scripts/update-skill.ts": "fixture"
      }).map(([name, value]) => [`${role}/${name}`, strToU8(value)])
    )
  );
  const runtimeZip = zipSync({ [role]: strToU8("binary fixture") });
  const asset = (name: string, data: Uint8Array) => ({
    name,
    byteLength: data.length,
    sha256: createHash("sha256").update(data).digest("hex")
  });
  const entry = (name: string, version: number) => ({
    version,
    native: {
      schemaVersion: 1,
      runtimeVersion: "0.1.0",
      sourceHash: hash,
      package: asset(`${name}-native.zip`, packageZip),
      targets: {
        [target]: asset(`${name}-0.1.0-${target}.zip`, runtimeZip),
        "x86_64-pc-windows-msvc": asset(
          `${name}-0.1.0-x86_64-pc-windows-msvc.zip`,
          runtimeZip
        )
      },
      bootstrap: asset("record-native-installer.zip", runtimeZip)
    }
  });
  const manifestBytes = Buffer.from(
    JSON.stringify({
      schemaVersion: 1,
      skills: {
        [role]: entry(role, 110),
        "investigation-report": entry("investigation-report", 99)
      }
    })
  );
  const files = prepareBundleWithEvidence({
    role,
    target,
    manifestBytes,
    packageZip,
    runtimeZip
  });
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "native-evidence-"));
  try {
    const freshPlan = await planNativeHandoff({
      target: root,
      role,
      platform: target,
      files
    });
    assert.equal(freshPlan.retire.length, 0);
    assert.ok(freshPlan.add.includes("SKILL.md"));
    const records = [];
    for (const file of files) {
      const filename = path.join(root, file.path);
      await fs.mkdir(path.dirname(filename), { recursive: true });
      const mode = file.path.startsWith("bin/") ? 0o755 : 0o644;
      await fs.writeFile(filename, file.data, { mode });
      await fs.chmod(filename, mode);
      records.push({
        path: file.path,
        byteLength: file.data.length,
        sha256: createHash("sha256").update(file.data).digest("hex"),
        mode: (await fs.stat(filename)).mode & 0o777
      });
    }
    const receipt = {
      schemaVersion: 1,
      state: "complete",
      role,
      runtimeVersion: "0.1.0",
      sourceHash: hash,
      files: records
    };
    const receiptPath = path.join(root, ".record-native-receipt.json");
    await fs.writeFile(receiptPath, JSON.stringify(receipt));
    assert.equal(
      (await verifyInstalledNativeEvidence(root, role, target)).length,
      files.length
    );
    const updatePlan = await planNativeHandoff({
      target: root,
      role,
      platform: target,
      files: files.filter((file) => file.path !== "scripts/update-skill.ts")
    });
    assert.deepEqual(updatePlan.retire, ["scripts/update-skill.ts"]);
    assert.ok(updatePlan.replace.includes("SKILL.md"));
    if (process.platform === "win32") {
      const casePlan = await planNativeHandoff({
        target: root.toUpperCase(),
        role,
        platform: target,
        files
      });
      assert.ok(casePlan.replace.includes("SKILL.md"));
    }
    const alias = path.join(root, "alias");
    await fs.symlink(
      root,
      alias,
      process.platform === "win32" ? "junction" : "dir"
    );
    await assert.rejects(
      () => planNativeHandoff({ target: alias, role, platform: target, files }),
      /unsafe native directory/
    );
    const binary = path.join(root, "bin", role);
    await fs.writeFile(binary, "modified");
    await assert.rejects(
      () => verifyInstalledNativeEvidence(root, role, target),
      /differs/
    );
    const changedRecord = records.find((item) => item.path === `bin/${role}`)!;
    changedRecord.byteLength = Buffer.byteLength("modified");
    changedRecord.sha256 = createHash("sha256")
      .update("modified")
      .digest("hex");
    await fs.writeFile(receiptPath, JSON.stringify(receipt));
    await assert.rejects(
      () => verifyInstalledNativeEvidence(root, role, target),
      /differs/
    );
    await fs.writeFile(binary, "binary fixture");
    await fs.unlink(path.join(root, ".record-native-evidence", "package.zip"));
    await assert.rejects(
      () => verifyInstalledNativeEvidence(root, role, target),
      /missing installed native/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
