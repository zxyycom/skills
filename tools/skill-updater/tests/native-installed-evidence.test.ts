import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { planNativeHandoff } from "../src/native/native-plan.ts";
import { activateNativeBundle } from "../src/native/native-transaction.ts";
import { resumeNativeCleanup } from "../src/native/native-resume.ts";
import {
  inspectNativeRepair,
  repairMissingNativeMembers
} from "../src/native/native-repair.ts";
import { strToU8, unzipSync, zipSync } from "fflate";
import {
  prepareBundleWithEvidence,
  verifyInstalledNativeEvidence
} from "../src/native/installed-evidence.ts";

async function failSecondBackup(action: () => Promise<void>): Promise<number> {
  const original = fs.unlink;
  let removed = 0;
  try {
    fs.unlink = async (...args: Parameters<typeof fs.unlink>) => {
      if (
        path.basename(String(args[0])).startsWith("backup-") &&
        ++removed === 2
      )
        throw new Error("fixture cleanup failure");
      return await original(...args);
    };
    await assert.rejects(action, /cleanup pending/);
  } finally {
    fs.unlink = original;
  }
  return removed;
}

async function writeEvidenceFixture(
  root: string,
  files: readonly { path: string; data: Buffer }[],
  role: string,
  hash: string
) {
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
    backup: path.join(
      path.dirname(root),
      `.${path.basename(root)}.native-finished`
    ),
    role,
    runtimeVersion: "0.1.0",
    sourceHash: hash,
    files: records
  };
  const receiptPath = path.join(root, ".record-native-receipt.json");
  await fs.writeFile(receiptPath, JSON.stringify(receipt));
  return { records, receipt, receiptPath };
}

function nativeFixture() {
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
        "scripts/update-skill.ts": "fixture",
        "scripts/old-native.txt": "owned"
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
  return {
    role,
    target,
    hash,
    packageZip,
    runtimeZip,
    asset,
    manifestBytes,
    files
  } as const;
}

test("installed release evidence and current files jointly prove native ownership", async () => {
  const {
    role,
    target,
    hash,
    packageZip,
    runtimeZip,
    asset,
    manifestBytes,
    files
  } = nativeFixture();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "native-evidence-"));
  try {
    const destination = path.join(root, "fresh");
    const request = {
      role,
      target,
      destination,
      manifestBytes,
      packageZip,
      runtimeZip,
      confirm: async () => true,
      validatePrepared: async () => {}
    } as const;
    const failedDestination = path.join(root, "failed-fresh");
    await assert.rejects(
      () =>
        activateNativeBundle({
          ...request,
          destination: failedDestination,
          validatePrepared: async () => {
            throw new Error("fixture failure");
          }
        }),
      /changes restored/
    );
    await assert.rejects(fs.lstat(failedDestination), { code: "ENOENT" });
    const existingEmpty = path.join(root, "existing-empty");
    await fs.mkdir(existingEmpty);
    await assert.rejects(
      () =>
        activateNativeBundle({
          ...request,
          destination: existingEmpty,
          validatePrepared: async () => {
            throw new Error("fixture failure");
          }
        }),
      /changes restored/
    );
    assert.deepEqual(await fs.readdir(existingEmpty), []);
    await activateNativeBundle(request);
    await assert.rejects(
      () =>
        activateNativeBundle({
          ...request,
          validatePrepared: async () => {
            throw new Error("fixture failure");
          }
        }),
      /changes restored/
    );
    assert.equal(
      (await verifyInstalledNativeEvidence(destination, role, target)).length,
      files.length
    );
    await fs.writeFile(path.join(destination, "sentinel"), "untouched");
    await activateNativeBundle(request);
    assert.equal(
      await fs.readFile(path.join(destination, "sentinel"), "utf8"),
      "untouched"
    );
    assert.equal(
      (await verifyInstalledNativeEvidence(destination, role, target)).length,
      files.length
    );
    const nextContents = unzipSync(packageZip);
    delete nextContents[`${role}/scripts/old-native.txt`];
    nextContents[`${role}/SKILL.md`] = strToU8(
      '---\nname: decision-records\nmetadata:\n  version: "111"\n---\n'
    );
    const nextZip = zipSync(nextContents);
    const nextManifest = JSON.parse(manifestBytes.toString("utf8"));
    nextManifest.skills[role].version = 111;
    nextManifest.skills[role].native.package = asset(
      `${role}-native.zip`,
      nextZip
    );
    const nextRequest = {
      ...request,
      packageZip: nextZip,
      manifestBytes: Buffer.from(JSON.stringify(nextManifest))
    };
    await assert.rejects(
      () =>
        activateNativeBundle({
          ...nextRequest,
          validatePrepared: async () => {
            await fs.writeFile(
              path.join(destination, "scripts/old-native.txt"),
              "changed"
            );
          }
        }),
      /cleanup pending/
    );
    const pending = JSON.parse(
      await fs.readFile(
        path.join(destination, ".record-native-receipt.json"),
        "utf8"
      )
    );
    assert.equal(pending.state, "cleanup-pending");
    const proofPath = path.join(pending.backup, "native-previous-proof.zip");
    const proof = await fs.readFile(proofPath);
    await fs.unlink(proofPath);
    await assert.rejects(
      () => resumeNativeCleanup(nextRequest),
      /proof is missing/
    );
    await fs.writeFile(proofPath, proof);
    await assert.rejects(
      () => resumeNativeCleanup(nextRequest),
      /retired file changed/
    );
    await fs.writeFile(
      path.join(destination, "scripts/old-native.txt"),
      "owned"
    );
    await resumeNativeCleanup(nextRequest);
    await assert.rejects(
      fs.lstat(path.join(destination, "scripts/old-native.txt")),
      { code: "ENOENT" }
    );
    await assert.rejects(fs.lstat(pending.backup), { code: "ENOENT" });
    assert.equal(
      await fs.readFile(path.join(destination, "sentinel"), "utf8"),
      "untouched"
    );
    nextContents[`${role}/SKILL.md`] = strToU8(
      '---\nname: decision-records\nmetadata:\n  version: "112"\n---\n'
    );
    const thirdZip = zipSync(nextContents);
    nextManifest.skills[role].version = 112;
    nextManifest.skills[role].native.package = asset(
      `${role}-native.zip`,
      thirdZip
    );
    const thirdRequest = {
      ...request,
      packageZip: thirdZip,
      manifestBytes: Buffer.from(JSON.stringify(nextManifest))
    };
    const removed = await failSecondBackup(() =>
      activateNativeBundle(thirdRequest)
    );
    const partial = JSON.parse(
      await fs.readFile(
        path.join(destination, ".record-native-receipt.json"),
        "utf8"
      )
    );
    assert.equal(partial.state, "complete");
    assert.ok(removed >= 2);
    assert.ok(
      (
        await fs.stat(path.join(partial.backup, "native-previous-proof.zip"))
      ).isFile()
    );
    await assert.rejects(
      () => activateNativeBundle(thirdRequest),
      /cleanup pending/
    );
    await resumeNativeCleanup(thirdRequest);
    await assert.rejects(fs.lstat(partial.backup), { code: "ENOENT" });
    assert.equal(
      await fs.readFile(path.join(destination, "sentinel"), "utf8"),
      "untouched"
    );
    const freshPlan = await planNativeHandoff({
      target: root,
      role,
      platform: target,
      files
    });
    assert.equal(freshPlan.retire.length, 0);
    assert.ok(freshPlan.add.includes("SKILL.md"));
    const { records, receipt, receiptPath } = await writeEvidenceFixture(
      root,
      files,
      role,
      hash
    );
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

test("native missing member repair proves ownership and never overwrites conflicts", async () => {
  const { role, target, hash, files } = nativeFixture();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "native-repair-"));
  try {
    await writeEvidenceFixture(root, files, role, hash);
    const binary = path.join(root, "bin", role);
    await fs.unlink(binary);
    const inspection = await inspectNativeRepair(root, role, target);
    assert.deepEqual(inspection.missing, [`bin/${role}`]);
    await assert.rejects(fs.stat(binary), /ENOENT/);
    await repairMissingNativeMembers({ root, role, target, inspection });
    assert.equal(await fs.readFile(binary, "utf8"), "binary fixture");
    await fs.writeFile(binary, "changed");
    await assert.rejects(
      () => inspectNativeRepair(root, role, target),
      /differs/
    );
    await fs.writeFile(binary, "binary fixture");
    await fs.unlink(binary);
    await fs.rmdir(path.join(root, "bin"));
    const retry = await inspectNativeRepair(root, role, target);
    await assert.rejects(
      () =>
        repairMissingNativeMembers({
          root,
          role,
          target,
          inspection: retry,
          validate: async () => {
            throw new Error("validation failed");
          }
        }),
      /created members restored/
    );
    await assert.rejects(fs.stat(path.join(root, "bin")), /ENOENT/);
    await assert.rejects(
      () =>
        repairMissingNativeMembers({
          root,
          role,
          target,
          inspection: retry,
          afterCreate: async () => {
            await fs.truncate(binary, 3);
            throw new Error("changed after creation");
          }
        }),
      /rollback incomplete/
    );
    assert.equal(await fs.readFile(binary, "utf8"), "bin");
    await fs.unlink(binary);
    await fs.rmdir(path.join(root, "bin"));
    await fs.mkdir(path.join(root, "bin"));
    await fs.writeFile(binary, "concurrent file");
    await assert.rejects(
      () =>
        repairMissingNativeMembers({ root, role, target, inspection: retry }),
      /differs/
    );
    assert.equal(await fs.readFile(binary, "utf8"), "concurrent file");
    await fs.unlink(path.join(root, ".record-native-evidence", "package.zip"));
    await assert.rejects(
      () => inspectNativeRepair(root, role, target),
      /missing installed native/
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
