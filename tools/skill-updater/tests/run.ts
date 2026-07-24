import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

assert.equal(skillUpdaterConfig.skillName, skillName);
assert.equal(
  skillUpdaterConfig.releaseManifestAssetName,
  "skill-release-manifest.json"
);
assert.equal(typeof runSkillUpdaterCli, "function");
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
assert.match(helpOutput.join("\n"), /installed version differs from the remote version/);

const generatedDeclaration = await fs.readFile(generatedDeclarationPath, "utf8");
assert.match(
  generatedDeclaration,
  /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/tools\/skill-updater\/api\/update-skill\.d\.mts/
);
assert.match(generatedDeclaration, /releaseManifestAssetName/);
assert.match(generatedDeclaration, /runSkillUpdaterCli/);
assert.match(generatedDeclaration, /skillUpdaterConfig/);

type UpdaterRunOptions = {
  args: string[];
  manifest: unknown;
  release: unknown;
  targetDir: string;
  zipData: Uint8Array;
};

function skillMarkdown(version: number, body: string): string {
  return [
    "---",
    `name: ${skillName}`,
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

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skill-updater-test-"));
try {
  const mockFetchPath = path.join(tempRoot, "mock-fetch.cjs");
  await fs.writeFile(
    mockFetchPath,
    [
      "const releaseJson = process.env.SKILLS_TEST_RELEASE_JSON;",
      "const manifestJson = process.env.SKILLS_TEST_MANIFEST_JSON;",
      "const zipBase64 = process.env.SKILLS_TEST_ZIP_BASE64;",
      "globalThis.fetch = async (input) => {",
      "  const url = String(input);",
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
  const zipData = zipSync(Object.fromEntries(
    remoteFiles.map((file) => [`${skillName}/${file.path}`, file.data])
  ));
  const validManifest = {
    schemaVersion: 1,
    skills: {
      [skillName]: { version: 2 }
    }
  };

  const successTarget = path.join(tempRoot, "success-target");
  await fs.mkdir(successTarget);
  await fs.writeFile(
    path.join(successTarget, "SKILL.md"),
    skillMarkdown(1, "# Old skill"),
    "utf8"
  );
  await fs.writeFile(path.join(successTarget, "stale.md"), "# Keep this customization\n", "utf8");

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

  const customizedCurrentTarget = path.join(tempRoot, "customized-current-target");
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
  assert.match(unversioned.stdout, /Status: update available \(local version unknown\)/);

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
  assert.match(mismatch.stderr, /does not match skill-release-manifest\.json version/);
  assert.equal(
    await fs.readFile(path.join(mismatchTarget, "SKILL.md"), "utf8"),
    mismatchSkillMarkdown
  );

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

  const invalidManifest = runUpdater(mockFetchPath, {
    args: ["--check"],
    manifest: {},
    release: validRelease,
    targetDir: path.join(tempRoot, "invalid-manifest-target"),
    zipData
  });
  assert.equal(invalidManifest.status, 1);
  assert.match(invalidManifest.stderr, /contains invalid skill-release-manifest\.json/);
  assert.match(invalidManifest.stderr, /schemaVersion/);
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Skill updater integration tests passed.");
