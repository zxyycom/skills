import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  nativeRoles,
  type NativeRole
} from "../../../tools/skill-package/src/native-release-manifest.ts";
import { command } from "./ci-bootstrap-process.ts";
import { verifyWindowsLockedUpgrade } from "./ci-bootstrap-lock.ts";
import { mockedRelease, type Release } from "./ci-bootstrap-release.ts";

type Entry = { run(args: string[]): Promise<number> };
type Scenario = {
  role: NativeRole;
  destination: string;
  binary: string;
  bootstrap: string;
  updater: Entry;
  b: Release;
};

/** A fresh installation requires an empty target; existing legacy files may coexist with a sentinel. */
export async function installFirstCandidate(
  destination: string,
  legacy: boolean,
  entry: Entry
): Promise<void> {
  const sentinel = path.join(destination, "sentinel.txt");
  await fs.mkdir(destination, { recursive: true });
  if (legacy) await fs.writeFile(sentinel, "keep", { flag: "wx" });
  assert.equal(await entry.run(["--check", "--target-dir", destination]), 1);
  assert.equal(await entry.run(["--yes", "--target-dir", destination]), 0);
  if (!legacy) await fs.writeFile(sentinel, "keep", { flag: "wx" });
}

async function verifyRollbackAndResume({
  role,
  destination,
  binary,
  bootstrap,
  updater,
  b
}: Scenario): Promise<void> {
  const transaction = await import(
    pathToFileURL(
      path.join(
        bootstrap,
        "scripts/runtime/tools/skill-updater/src/native/native-transaction.ts"
      )
    ).href
  );
  await assert.rejects(
    transaction.activateNativeBundle({
      role,
      target: "x86_64-pc-windows-msvc",
      manifestBytes: b.manifestBytes,
      packageZip: b.prepared.packages[role].bytes,
      runtimeZip: b.archives[role]["x86_64-pc-windows-msvc"],
      destination,
      confirm: async () => true,
      validatePrepared: async () => {
        throw new Error("private validation failure");
      }
    }),
    /restored/
  );
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    `${role} 0.1.0`
  );
  const unlink = fs.unlink;
  let backupRemovals = 0;
  try {
    fs.unlink = async (...args: Parameters<typeof fs.unlink>) => {
      if (
        path.basename(String(args[0])).startsWith("backup-") &&
        ++backupRemovals === 2
      )
        throw new Error("private cleanup failure");
      return await unlink(...args);
    };
    await assert.rejects(updater.run(["--yes"]), /cleanup pending/);
  } finally {
    fs.unlink = unlink;
  }
  assert.equal(await updater.run(["--check"]), 1);
  assert.equal(await updater.run(["--yes"]), 0);
}

async function verifyRepairAndConflict(
  { role, destination, binary, updater }: Scenario,
  legacy: boolean
): Promise<void> {
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    `${role} 0.1.1`
  );
  assert.equal(await updater.run(["--check"]), 0);
  await fs.unlink(binary);
  assert.equal(await updater.run(["--check"]), 1);
  assert.equal(await updater.run(["--yes"]), 0);
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    `${role} 0.1.1`
  );
  assert.equal(await updater.run(["--check"]), 0);
  if (role === "decision-records" && legacy) {
    const original = await fs.readFile(binary);
    await fs.writeFile(binary, "modified by private fixture");
    await assert.rejects(updater.run(["--yes"]));
    assert.equal(
      await fs.readFile(binary, "utf8"),
      "modified by private fixture"
    );
    await fs.writeFile(binary, original);
  }
  assert.equal(
    await fs.readFile(path.join(destination, "sentinel.txt"), "utf8"),
    "keep"
  );
}

async function verifyDestination(
  role: NativeRole,
  destination: string,
  legacy: boolean,
  bootstrap: string,
  entry: Entry,
  a: Release,
  b: Release
): Promise<void> {
  await installFirstCandidate(destination, legacy, entry);
  await assert.rejects(fs.lstat(path.join(destination, "node_modules")), {
    code: "ENOENT"
  });
  const binary = path.join(destination, "bin", `${role}.exe`);
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    `${role} 0.1.0`
  );
  command(binary, ["--help"], destination);
  command(
    "pnpm",
    [
      "install",
      "--prod",
      "--frozen-lockfile",
      "--ignore-workspace",
      "--config.node-linker=isolated"
    ],
    destination
  );
  command(
    process.execPath,
    [path.join(destination, "scripts/update-skill.ts"), "--help"],
    destination
  );
  const updater = await import(
    pathToFileURL(path.join(destination, "scripts/update-skill.ts")).href
  );
  assert.equal(await updater.run(["--check"]), 0);
  assert.equal(await updater.run(["--yes"]), 0);
  globalThis.fetch = mockedRelease(b);
  assert.equal(await updater.run(["--check"]), 1);
  const scenario = { role, destination, binary, bootstrap, updater, b };
  if (role === "decision-records" && legacy) {
    await verifyWindowsLockedUpgrade({
      binary,
      bootstrap,
      destination,
      updater
    });
    await verifyRollbackAndResume(scenario);
  } else assert.equal(await updater.run(["--yes"]), 0);
  await verifyRepairAndConflict(scenario, legacy);
  globalThis.fetch = mockedRelease(a);
  console.log(
    `PASS ${role}: ${legacy ? "historical legacy" : "fresh"}, A to B, readiness, missing binary repair, sentinel`
  );
}

export async function verifyScenarios(
  temp: string,
  bootstrap: string,
  legacy: Record<NativeRole, string>,
  a: Release,
  b: Release
): Promise<void> {
  for (const role of nativeRoles) {
    const entry: Entry = await import(
      pathToFileURL(path.join(bootstrap, "scripts", `${role}.ts`)).href
    );
    for (const destination of [path.join(temp, `fresh-${role}`), legacy[role]])
      await verifyDestination(
        role,
        destination,
        destination === legacy[role],
        bootstrap,
        entry,
        a,
        b
      );
  }
}
