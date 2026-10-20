import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { zipSync } from "fflate";
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

test("updater rejects a manifest version that differs from the package", async () => {
  const mismatchTarget = path.join(tempRoot, "mismatch-target");
  await fs.mkdir(mismatchTarget);
  const mismatchSkillMarkdown = skillMarkdown(1, "# Keep this skill");
  await fs.writeFile(
    path.join(mismatchTarget, "SKILL.md"),
    mismatchSkillMarkdown,
    "utf8"
  );

  const mismatch = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: {
      ...validManifest,
      skills: { [skillName]: { version: 3 } }
    },
    release: validRelease,
    targetDir: mismatchTarget,
    zipData
  });
  assert.equal(mismatch.status, 1);
  assert.match(
    mismatch.stderr,
    /does not match skill-release-manifest\.json version/
  );
  assert.equal(
    await fs.readFile(path.join(mismatchTarget, "SKILL.md"), "utf8"),
    mismatchSkillMarkdown
  );
});

test("updater rejects a remote package owned by another skill", async () => {
  const wrongRemoteTarget = path.join(tempRoot, "wrong-remote-target");
  await fs.mkdir(wrongRemoteTarget);
  const wrongRemoteLocalMarkdown = skillMarkdown(1, "# Keep this skill");
  await fs.writeFile(
    path.join(wrongRemoteTarget, "SKILL.md"),
    wrongRemoteLocalMarkdown,
    "utf8"
  );
  const wrongRemoteSkillMarkdown = skillMarkdown(
    2,
    "# Different remote skill",
    "different-skill"
  );
  const wrongRemoteZipData = zipSync({
    [`${skillName}/SKILL.md`]: Buffer.from(wrongRemoteSkillMarkdown, "utf8")
  });

  const wrongRemote = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: wrongRemoteTarget,
    zipData: wrongRemoteZipData
  });
  assert.equal(wrongRemote.status, 1);
  assert.match(
    wrongRemote.stderr,
    /identifies skill "different-skill" in SKILL\.md, but this updater expects "ai-ready-docs"/
  );
  assert.doesNotMatch(wrongRemote.stdout, /Updated skill successfully\./);
  assert.equal(
    await fs.readFile(path.join(wrongRemoteTarget, "SKILL.md"), "utf8"),
    wrongRemoteLocalMarkdown
  );
});

test("updater rejects aliased non-canonical package paths", async () => {
  const aliasedRemoteTarget = path.join(tempRoot, "aliased-remote-target");
  await fs.mkdir(aliasedRemoteTarget);
  const aliasedRemoteLocalMarkdown = skillMarkdown(1, "# Keep this skill");
  await fs.writeFile(
    path.join(aliasedRemoteTarget, "SKILL.md"),
    aliasedRemoteLocalMarkdown,
    "utf8"
  );
  const aliasedRemoteZipData = zipSync({
    [`${skillName}/SKILL.md`]: Buffer.from(remoteSkillMarkdown, "utf8"),
    [`${skillName}/references/../SKILL.md`]: Buffer.from(
      skillMarkdown(2, "# Must not replace the validated entry"),
      "utf8"
    )
  });
  const aliasedRemote = runUpdater(mockFetchPath, {
    args: ["--yes"],
    manifest: validManifest,
    release: validRelease,
    targetDir: aliasedRemoteTarget,
    zipData: aliasedRemoteZipData
  });
  assert.equal(aliasedRemote.status, 1);
  assert.match(aliasedRemote.stderr, /non-canonical skill path/);
  assert.equal(
    await fs.readFile(path.join(aliasedRemoteTarget, "SKILL.md"), "utf8"),
    aliasedRemoteLocalMarkdown
  );
});

test("updater reports invalid release payloads", () => {
  const invalidRelease = runUpdater(mockFetchPath, {
    args: ["--check"],
    manifest: validManifest,
    release: {},
    targetDir: path.join(tempRoot, "invalid-release-target"),
    zipData
  });
  assert.equal(invalidRelease.status, 1);
  assert.match(invalidRelease.stderr, /GitHub release response .* is invalid/);
  assert.match(invalidRelease.stderr, /assets/);
});

test("updater reports invalid manifest payloads", () => {
  const invalidManifest = runUpdater(mockFetchPath, {
    args: ["--check"],
    manifest: {},
    release: validRelease,
    targetDir: path.join(tempRoot, "invalid-manifest-target"),
    zipData
  });
  assert.equal(invalidManifest.status, 1);
  assert.match(
    invalidManifest.stderr,
    /contains invalid skill-release-manifest\.json/
  );
  assert.match(invalidManifest.stderr, /schemaVersion/);
});
