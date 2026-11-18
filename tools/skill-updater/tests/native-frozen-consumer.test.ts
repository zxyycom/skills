import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fixture } from "../../../scripts/lib/record-native/tests/candidate-publish-fixture.ts";
import { parseNativeReleasePair } from "./fixtures/frozen-native-consumer-925de860/tools/skill-package/src/native-release-manifest.ts";
import { readSkillPackageIdentityFromMarkdown } from "./fixtures/frozen-native-consumer-925de860/tools/skill-package/src/version.ts";
import { prepareNativeBundle } from "./fixtures/frozen-native-consumer-925de860/tools/skill-updater/src/native/bundle.ts";
import { applyOverlay } from "./fixtures/frozen-native-consumer-925de860/tools/skill-updater/src/native/overlay.ts";

test("frozen 925de860 consumer prepares old roles from a three-role release", async () => {
  const candidate = fixture();
  const oldReleases = parseNativeReleasePair(candidate.manifest);
  const target =
    process.platform === "win32"
      ? "x86_64-pc-windows-msvc"
      : "x86_64-unknown-linux-gnu";
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "frozen-native-consumer-")
  );
  try {
    for (const role of ["decision-records", "investigation-report"] as const) {
      const destination = path.join(root, role);
      await fs.mkdir(destination);
      await fs.writeFile(
        path.join(destination, "SKILL.md"),
        `---\nname: ${role}\nmetadata:\n  version: '1'\n---\n`
      );
      await fs.writeFile(path.join(destination, "unrelated.txt"), "preserve");
      const release = oldReleases[role];
      const bytes = (name: string) =>
        candidate.assets.find((item) => item.asset.name === name)!.bytes;
      const files = prepareNativeBundle({
        role,
        target,
        release,
        packageZip: bytes(release.native.package.name),
        runtimeZip: bytes(release.native.targets[target].name)
      });
      const executable =
        target === "x86_64-pc-windows-msvc" ? `${role}.exe` : role;
      let validated = false;
      await applyOverlay(destination, files, async () => {
        assert.equal(
          await fs.readFile(path.join(destination, "bin", executable), "utf8"),
          "binary"
        );
        const before = readSkillPackageIdentityFromMarkdown(
          await fs.readFile(path.join(destination, "SKILL.md"), "utf8")
        );
        assert.equal(before.version, 1);
        validated = true;
      });
      assert.ok(validated);
      const identity = readSkillPackageIdentityFromMarkdown(
        await fs.readFile(path.join(destination, "SKILL.md"), "utf8")
      );
      assert.deepEqual(identity, { name: role, version: release.version });
      assert.equal(
        await fs.readFile(path.join(destination, "bin", executable), "utf8"),
        "binary"
      );
      assert.equal(
        await fs.readFile(path.join(destination, "unrelated.txt"), "utf8"),
        "preserve"
      );
      for (const file of files)
        assert.deepEqual(
          await fs.readFile(path.join(destination, ...file.path.split("/"))),
          file.data
        );
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
