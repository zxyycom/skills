import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { pathExists } from "../../../lib/filesystem.ts";
import { calculateSkillPackageFingerprint } from "../../../lib/skill-package-fingerprint.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDirectory, "../../../..");
const skillName = "prompt-optimize";
const generatedUpdaterPath = path.join(
  rootDir,
  "skills",
  skillName,
  "scripts",
  "update-skill.cjs"
);
const lockAssetUrl = "https://example.test/skill-package-lock.json";
const zipAssetUrl = `https://example.test/${skillName}.zip`;
const validRelease = {
  assets: [
    { name: "skill-package-lock.json", url: lockAssetUrl },
    { name: `${skillName}.zip`, url: zipAssetUrl }
  ],
  html_url: "https://example.test/releases/review",
  tag_name: "review"
};

type UpdaterRunOptions = {
  args: string[];
  lock: unknown;
  release: unknown;
  targetDir: string;
  zipData: Uint8Array;
};

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
        SKILLS_TEST_LOCK_JSON: JSON.stringify(options.lock),
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

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skill-updater-test-"));
try {
  const mockFetchPath = path.join(tempRoot, "mock-fetch.cjs");
  await fs.writeFile(
    mockFetchPath,
    [
      "const releaseJson = process.env.SKILLS_TEST_RELEASE_JSON;",
      "const lockJson = process.env.SKILLS_TEST_LOCK_JSON;",
      "const zipBase64 = process.env.SKILLS_TEST_ZIP_BASE64;",
      "globalThis.fetch = async (input) => {",
      "  const url = String(input);",
      "  if (url.startsWith('https://api.github.com/repos/')) {",
      "    return new Response(releaseJson, { status: 200 });",
      "  }",
      `  if (url === ${JSON.stringify(lockAssetUrl)}) {`,
      "    return new Response(lockJson, { status: 200 });",
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

  const remoteFiles = [
    {
      data: Buffer.from("# Updated prompt optimizer\n", "utf8"),
      path: "SKILL.md"
    },
    {
      data: Buffer.from("# Current reference\n", "utf8"),
      path: "references/current.md"
    }
  ];
  const zipData = zipSync(Object.fromEntries(
    remoteFiles.map((file) => [`${skillName}/${file.path}`, file.data])
  ));
  const remoteFingerprint = calculateSkillPackageFingerprint(skillName, remoteFiles);
  const validLock = {
    aggregateHash: "a".repeat(64),
    schemaVersion: 1,
    skills: {
      [skillName]: remoteFingerprint
    }
  };

  const successTarget = path.join(tempRoot, "success-target");
  await fs.mkdir(successTarget);
  await fs.writeFile(path.join(successTarget, "SKILL.md"), "# Old skill\n", "utf8");
  await fs.writeFile(path.join(successTarget, "stale.md"), "# Stale\n", "utf8");

  const success = runUpdater(mockFetchPath, {
    args: ["--yes"],
    lock: validLock,
    release: validRelease,
    targetDir: successTarget,
    zipData
  });
  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /Updated skill successfully\./);
  assert.equal(
    await fs.readFile(path.join(successTarget, "SKILL.md"), "utf8"),
    "# Updated prompt optimizer\n"
  );
  assert.equal(await pathExists(path.join(successTarget, "stale.md")), false);

  const mismatchTarget = path.join(tempRoot, "mismatch-target");
  await fs.mkdir(mismatchTarget);
  await fs.writeFile(path.join(mismatchTarget, "SKILL.md"), "# Keep this skill\n", "utf8");

  const mismatch = runUpdater(mockFetchPath, {
    args: ["--yes"],
    lock: {
      ...validLock,
      skills: { [skillName]: "0".repeat(64) }
    },
    release: validRelease,
    targetDir: mismatchTarget,
    zipData
  });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /does not match skill-package-lock\.json hash/);
  assert.equal(
    await fs.readFile(path.join(mismatchTarget, "SKILL.md"), "utf8"),
    "# Keep this skill\n"
  );

  const invalidRelease = runUpdater(mockFetchPath, {
    args: ["--check"],
    lock: validLock,
    release: {},
    targetDir: path.join(tempRoot, "invalid-release-target"),
    zipData
  });
  assert.equal(invalidRelease.status, 1);
  assert.match(invalidRelease.stderr, /GitHub release response .* is invalid/);
  assert.match(invalidRelease.stderr, /assets/);

  const invalidLock = runUpdater(mockFetchPath, {
    args: ["--check"],
    lock: {},
    release: validRelease,
    targetDir: path.join(tempRoot, "invalid-lock-target"),
    zipData
  });
  assert.equal(invalidLock.status, 1);
  assert.match(invalidLock.stderr, /contains invalid skill-package-lock\.json/);
  assert.match(invalidLock.stderr, /aggregateHash/);
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Skill updater integration tests passed.");
