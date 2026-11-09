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
/** Exercise a fresh or matching target and verify its local sentinel. */
export async function installFirstCandidate(
  destination: string,
  existing: boolean,
  entry: Entry
): Promise<void> {
  const sentinel = path.join(destination, "sentinel.txt");
  await fs.mkdir(destination, { recursive: true });
  if (existing) await fs.writeFile(sentinel, "keep", { flag: "wx" });
  assert.equal(await entry.run(["--check", "--target-dir", destination]), 1);
  assert.equal(await entry.run(["--yes", "--target-dir", destination]), 0);
  if (!existing) await fs.writeFile(sentinel, "keep", { flag: "wx" });
}

async function verifyDestination(
  role: NativeRole,
  destination: string,
  relocate: boolean,
  entry: Entry,
  a: Release,
  b: Release
): Promise<void> {
  await installFirstCandidate(destination, false, entry);
  if (relocate) {
    await fs.writeFile(
      path.join(destination, ".record-native-receipt.json"),
      '{"backup":"C:/old/location"}'
    );
    const relocated = `${destination}-relocated`;
    await fs.rename(destination, relocated);
    destination = relocated;
  }
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

  if (role === "decision-records" && relocate)
    await verifyWindowsLockedUpgrade({
      binary,
      destination,
      updater
    });
  assert.equal(await updater.run(["--yes"]), 0);
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    `${role} 0.1.1`
  );
  assert.equal(await updater.run(["--check"]), 0);
  await fs.unlink(binary);
  assert.equal(await updater.run(["--check"]), 0);
  assert.equal(await entry.run(["--yes", "--target-dir", destination]), 0);
  assert.equal(
    command(binary, ["--version"], destination).toString().trim(),
    `${role} 0.1.1`
  );
  assert.equal(
    await fs.readFile(path.join(destination, "sentinel.txt"), "utf8"),
    "keep"
  );
  globalThis.fetch = mockedRelease(a);
  console.log(
    `PASS ${role}: ${relocate ? "relocated" : "fresh"}, A to B, version check, explicit reinstall, sentinel`
  );
}

export async function verifyScenarios(
  temp: string,
  bootstrap: string,
  a: Release,
  b: Release
): Promise<void> {
  for (const role of nativeRoles) {
    const entry: Entry = await import(
      pathToFileURL(path.join(bootstrap, "scripts", `${role}.ts`)).href
    );
    for (const destination of [
      path.join(temp, `fresh-${role}`),
      path.join(temp, `relocate-${role}`)
    ])
      await verifyDestination(
        role,
        destination,
        destination.includes("relocate-"),
        entry,
        a,
        b
      );
  }
}
