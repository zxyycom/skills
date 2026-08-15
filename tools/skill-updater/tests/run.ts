import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import {
  runSkillUpdaterCli,
  skillUpdaterConfig
} from "../../../skills/ai-ready-docs/scripts/update-skill.mjs";
import { pathExists } from "../../shared/src/node/filesystem.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDirectory, "../../..");
const skillName = "ai-ready-docs";
const generatedUpdaterPath = path.join(
  rootDir,
  "skills",
  skillName,
  "scripts",
  "update-skill.mjs"
);
const generatedDeclarationPath = path.join(
  rootDir,
  "skills",
  skillName,
  "scripts",
  "update-skill.d.mts"
);
const manifestAssetUrl = "https://example.test/skill-release-manifest.json";
const zipAssetUrl = `https://example.test/${skillName}.zip`;
const validRelease = {
  assets: [
    { name: "skill-release-manifest.json", url: manifestAssetUrl },
    { name: `${skillName}.zip`, url: zipAssetUrl }
  ],
  html_url: "https://example.test/releases/review",
  tag_name: "review"
};

type UpdaterRunOptions = {
  args: string[];
  fetchMarkerPath?: string;
  manifest: unknown;
  release: unknown;
  targetDir: string;
  zipData: Uint8Array;
};

function skillMarkdown(
  version: number,
  body: string,
  name: string = skillName
): string {
  return [
    "---",
    `name: ${name}`,
    "description: AI-ready docs test skill",
    "metadata:",
    `  version: "${version}"`,
    "---",
    "",
    body,
    ""
  ].join("\n");
}

function runUpdater(
  mockFetchPath: string,
  options: UpdaterRunOptions
): SpawnSyncReturns<string> {
  const result = spawnSync(
    "node",
    [
      "--require",
      mockFetchPath,
      generatedUpdaterPath,
      ...options.args,
      "--target-dir",
      options.targetDir
    ],
    {
      cwd: rootDir,
      encoding: "utf8",
      env: {
        ...process.env,
        SKILLS_TEST_FETCH_MARKER_PATH: options.fetchMarkerPath ?? "",
        SKILLS_TEST_MANIFEST_JSON: JSON.stringify(options.manifest),
        SKILLS_TEST_RELEASE_JSON: JSON.stringify(options.release),
        SKILLS_TEST_ZIP_BASE64: Buffer.from(options.zipData).toString("base64")
      }
    }
  );

  if (result.error) {
    throw result.error;
  }
  return result;
}

const tempRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "skill-updater-test-")
);
after(async () => {
  await fs.rm(tempRoot, { force: true, recursive: true });
});

const mockFetchPath = path.join(tempRoot, "mock-fetch.cjs");
await fs.writeFile(
  mockFetchPath,
  [
    "const fs = require('node:fs');",
    "const releaseJson = process.env.SKILLS_TEST_RELEASE_JSON;",
    "const manifestJson = process.env.SKILLS_TEST_MANIFEST_JSON;",
    "const zipBase64 = process.env.SKILLS_TEST_ZIP_BASE64;",
    "const fetchMarkerPath = process.env.SKILLS_TEST_FETCH_MARKER_PATH;",
    "globalThis.fetch = async (input) => {",
    "  const url = String(input);",
    "  if (fetchMarkerPath) fs.writeFileSync(fetchMarkerPath, url, 'utf8');",
    "  if (url.startsWith('https://api.github.com/repos/')) {",
    "    return new Response(releaseJson, { status: 200 });",
    "  }",
    `  if (url === ${JSON.stringify(manifestAssetUrl)}) {`,
    "    return new Response(manifestJson, { status: 200 });",
    "  }",
    `  if (url === ${JSON.stringify(zipAssetUrl)}) {`,
    "    return new Response(Buffer.from(zipBase64, 'base64'), { status: 200 });",
    "  }",
    "  return new Response('not found', { status: 404 });",
    "};",
    ""
  ].join("\n"),
  "utf8"
);

const remoteSkillMarkdown = skillMarkdown(2, "# Updated AI-ready docs");
const remoteFiles = [
  {
    data: Buffer.from(remoteSkillMarkdown, "utf8"),
    path: "SKILL.md"
  },
  {
    data: Buffer.from("# Current reference\n", "utf8"),
    path: "references/current.md"
  }
];
const zipData = zipSync(
  Object.fromEntries(
    remoteFiles.map((file) => [`${skillName}/${file.path}`, file.data])
  )
);
const validManifest = {
  schemaVersion: 1,
  skills: {
    [skillName]: { version: 2 }
  }
};

test("updater configuration exposes the public contract", () => {
  assert.equal(skillUpdaterConfig.skillName, skillName);
  assert.equal(
    skillUpdaterConfig.releaseManifestAssetName,
    "skill-release-manifest.json"
  );
  assert.equal(typeof runSkillUpdaterCli, "function");
});

test("updater help exposes the public CLI contract", async () => {
  const helpOutput: string[] = [];
  const originalConsoleLog = console.log;
  console.log = (...values: unknown[]) => {
    helpOutput.push(values.map(String).join(" "));
  };
  try {
    assert.equal(await runSkillUpdaterCli(["--help"]), 0);
  } finally {
    console.log = originalConsoleLog;
  }
  assert.match(helpOutput.join("\n"), /Usage: node update-skill\.mjs/);
  assert.match(
    helpOutput.join("\n"),
    /installed version differs from the remote version/
  );
});

test("updater declarations expose the public API contract", async () => {
  const generatedDeclaration = await fs.readFile(
    generatedDeclarationPath,
    "utf8"
  );
  assert.match(
    generatedDeclaration,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/skill-updater\/api\/update-skill\.d\.mts/
  );
  assert.match(generatedDeclaration, /releaseManifestAssetName/);
  assert.match(
    generatedDeclaration,
    /Expected SKILL\.md frontmatter name for the local target and remote package/
  );
  assert.match(generatedDeclaration, /runSkillUpdaterCli/);
  assert.match(generatedDeclaration, /skillUpdaterConfig/);
});

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

test("updater check reports an unversioned installed skill", async () => {
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

  const unversioned = runUpdater(mockFetchPath, {
    args: ["--check"],
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
});

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
