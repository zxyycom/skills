import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathExists } from "../../shared/src/node/filesystem.ts";
import {
  skillName,
  validRelease,
  skillMarkdown,
  runUpdater,
  tempRoot,
  mockFetchPath,
  remoteSkillMarkdown,
  zipData,
  validManifest
} from "./support.ts";

test("updater replaces packaged files and preserves local custom files", async () => {
  const successTarget = path.join(tempRoot, "success-target");
  await fs.mkdir(successTarget);
  await fs.writeFile(
    path.join(successTarget, "SKILL.md"),
    skillMarkdown(1, "# Old skill"),
    "utf8"
  );
  await fs.writeFile(
    path.join(successTarget, "stale.md"),
    "# Keep this customization\n",
    "utf8"
  );

  const success = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: successTarget,
    zipData
  });
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /Files to replace:[\s\S]*SKILL\.md/);
  assert.match(success.stdout, /Files to add:[\s\S]*references\/current\.md/);
  assert.match(success.stdout, /Other local files will be kept\./);
  assert.match(success.stdout, /Updated skill successfully\./);
  assert.equal(
    await fs.readFile(path.join(successTarget, "SKILL.md"), "utf8"),
    remoteSkillMarkdown
  );
  assert.equal(await pathExists(path.join(successTarget, "stale.md")), true);
  assert.equal(
    await fs.readFile(path.join(successTarget, "stale.md"), "utf8"),
    "# Keep this customization\n"
  );
});

test("updater check treats a matching installed version as current", async () => {
  const customizedCurrentTarget = path.join(
    tempRoot,
    "customized-current-target"
  );
  await fs.mkdir(customizedCurrentTarget);
  await fs.writeFile(
    path.join(customizedCurrentTarget, "SKILL.md"),
    skillMarkdown(2, "# Locally customized current skill"),
    "utf8"
  );

  const customizedCurrent = runUpdater(mockFetchPath, {
    args: ["--check"],
    manifest: validManifest,
    release: validRelease,
    targetDir: customizedCurrentTarget,
    zipData
  });
  assert.equal(customizedCurrent.status, 0, customizedCurrent.stderr);
  assert.match(customizedCurrent.stdout, /Local version: 2/);
  assert.match(customizedCurrent.stdout, /Status: current/);
});

test("updater rejects a local directory owned by another skill", async () => {
  const wrongLocalTarget = path.join(tempRoot, "wrong-local-target");
  await fs.mkdir(wrongLocalTarget);
  const wrongLocalMarkdown = skillMarkdown(
    2,
    "# Different local skill",
    "different-skill"
  );
  await fs.writeFile(
    path.join(wrongLocalTarget, "SKILL.md"),
    wrongLocalMarkdown,
    "utf8"
  );

  const wrongLocal = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: wrongLocalTarget,
    zipData
  });
  assert.equal(wrongLocal.status, 1);
  assert.match(
    wrongLocal.stderr,
    /identifies skill "different-skill", but this updater expects "ai-ready-docs"/
  );
  assert.doesNotMatch(wrongLocal.stdout, /Status: current/);
  assert.doesNotMatch(wrongLocal.stdout, /Updated skill successfully\./);
  assert.equal(
    await fs.readFile(path.join(wrongLocalTarget, "SKILL.md"), "utf8"),
    wrongLocalMarkdown
  );
});

test("updater rejects a non-skill directory before fetching release data", async () => {
  const nonSkillTarget = path.join(tempRoot, "non-skill-target");
  const conflictPath = path.join(nonSkillTarget, "references", "current.md");
  const fetchMarkerPath = path.join(tempRoot, "non-skill-fetch-marker.txt");
  await fs.mkdir(path.dirname(conflictPath), { recursive: true });
  await fs.writeFile(conflictPath, "# Preserve this directory\n", "utf8");

  const nonSkill = runUpdater(mockFetchPath, {
    args: ["--yes"],
    fetchMarkerPath,
    manifest: validManifest,
    release: validRelease,
    targetDir: nonSkillTarget,
    zipData
  });
  assert.equal(nonSkill.status, 1);
  assert.match(
    nonSkill.stderr,
    /Target directory is not empty and does not contain SKILL\.md/
  );
  assert.equal(await pathExists(fetchMarkerPath), false);
  assert.equal(
    await fs.readFile(conflictPath, "utf8"),
    "# Preserve this directory\n"
  );
  assert.equal(await pathExists(path.join(nonSkillTarget, "SKILL.md")), false);
});

test("updater installs into a missing target directory", async () => {
  const missingTarget = path.join(tempRoot, "missing-target");
  const missing = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: missingTarget,
    zipData
  });
  assert.equal(missing.status, 0, missing.stderr);
  assert.match(missing.stdout, /Status: target missing/);
  assert.match(missing.stdout, /Updated skill successfully\./);
  assert.equal(
    await fs.readFile(path.join(missingTarget, "SKILL.md"), "utf8"),
    remoteSkillMarkdown
  );
});

test("updater installs into an empty target directory", async () => {
  const emptyTarget = path.join(tempRoot, "empty-target");
  await fs.mkdir(emptyTarget);
  const empty = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: emptyTarget,
    zipData
  });
  assert.equal(empty.status, 0, empty.stderr);
  assert.match(empty.stdout, /Local version: \(unversioned\)/);
  assert.match(empty.stdout, /Updated skill successfully\./);
  assert.equal(
    await fs.readFile(path.join(emptyTarget, "SKILL.md"), "utf8"),
    remoteSkillMarkdown
  );
});

test("updater check reports an unversioned installed skill without zip downloads or file changes", async () => {
  const unversionedTarget = path.join(tempRoot, "unversioned-target");
  await fs.mkdir(unversionedTarget);
  await fs.writeFile(
    path.join(unversionedTarget, "SKILL.md"),
    [
      "---",
      `name: ${skillName}`,
      "description: AI-ready docs test skill",
      "---",
      "",
      "# Unversioned skill",
      ""
    ].join("\n"),
    "utf8"
  );

  await fs.mkdir(path.join(unversionedTarget, "custom"));
  await fs.writeFile(
    path.join(unversionedTarget, "custom", "keep.bin"),
    Buffer.from([0, 255, 1])
  );
  const namesBefore = (
    await fs.readdir(unversionedTarget, { recursive: true })
  ).sort();
  const markdownBefore = await fs.readFile(
    path.join(unversionedTarget, "SKILL.md")
  );
  const customBefore = await fs.readFile(
    path.join(unversionedTarget, "custom", "keep.bin")
  );
  const fetchMarkerPath = path.join(tempRoot, "unversioned-fetch.jsonl");
  const unversioned = runUpdater(mockFetchPath, {
    args: ["--check"],
    fetchMarkerPath,
    manifest: validManifest,
    release: validRelease,
    targetDir: unversionedTarget,
    zipData
  });
  assert.equal(unversioned.status, 1);
  assert.match(unversioned.stdout, /Local version: \(unversioned\)/);
  assert.match(
    unversioned.stdout,
    /Status: update available \(local version unknown\)/
  );
  assert.deepEqual(
    (await fs.readdir(unversionedTarget, { recursive: true })).sort(),
    namesBefore
  );
  assert.deepEqual(
    await fs.readFile(path.join(unversionedTarget, "SKILL.md")),
    markdownBefore
  );
  assert.deepEqual(
    await fs.readFile(path.join(unversionedTarget, "custom", "keep.bin")),
    customBefore
  );
  const requests = (await fs.readFile(fetchMarkerPath, "utf8"))
    .trim()
    .split("\n");
  assert.equal(
    requests.some((url) => url.startsWith("https://api.github.com/repos/")),
    true
  );
  assert.equal(
    requests.some((url) => url.endsWith(".zip")),
    false
  );
  assert.equal(
    requests.some((url) => url.endsWith("skill-release-manifest.json")),
    true
  );
});

test("ordinary updater write failures restore replacements remove additions and allow retry", async () => {
  const { installSkillFiles } = await import("../src/installation.ts");
  const target = path.join(tempRoot, "rollback-target");
  await fs.mkdir(target);
  const original = skillMarkdown(1, "rollback original");
  await fs.writeFile(path.join(target, "SKILL.md"), original);
  await fs.writeFile(path.join(target, "custom.txt"), "untouched");
  const files = [
    { path: "SKILL.md", data: Buffer.from(remoteSkillMarkdown) },
    { path: "new.txt", data: Buffer.from("new") },
    { path: "fail.txt", data: Buffer.from("retry succeeds") }
  ];
  const copyFile = fs.copyFile;
  fs.copyFile = async (...args: Parameters<typeof fs.copyFile>) => {
    if (
      String(args[0]).includes(`${path.sep}staged${path.sep}`) &&
      String(args[1]) === path.join(target, "fail.txt")
    ) {
      throw new Error("injected ordinary copy failure");
    }
    return await copyFile(...args);
  };
  try {
    await assert.rejects(
      installSkillFiles(files, target),
      /injected ordinary copy failure/
    );
  } finally {
    fs.copyFile = copyFile;
  }
  assert.equal(
    await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
    original
  );
  assert.equal(await pathExists(path.join(target, "new.txt")), false);
  assert.equal(await pathExists(path.join(target, "fail.txt")), false);
  assert.equal(
    await fs.readFile(path.join(target, "custom.txt"), "utf8"),
    "untouched"
  );
  await installSkillFiles(files, target);
  assert.equal(
    await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
    remoteSkillMarkdown
  );
  assert.equal(
    await fs.readFile(path.join(target, "fail.txt"), "utf8"),
    "retry succeeds"
  );
});
