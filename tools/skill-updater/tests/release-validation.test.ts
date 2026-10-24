import assert from "node:assert/strict";
import test, { mock } from "node:test";
import path from "node:path";
import { zipSync } from "fflate";
import {
  loadRemoteSkillFiles,
  resolveRemoteSkillPackage
} from "../src/release.ts";
import {
  skillName,
  validRelease,
  skillMarkdown,
  remoteSkillMarkdown,
  skillUpdaterConfig,
  zipData,
  runUpdater,
  mockFetchPath,
  validManifest,
  tempRoot
} from "./support.ts";

async function withAssetResponse(
  data: Uint8Array,
  run: () => Promise<void>
): Promise<void> {
  const fetch = mock.method(
    globalThis,
    "fetch",
    async () => new Response(Buffer.from(data))
  );
  try {
    await run();
  } finally {
    fetch.mock.restore();
  }
}

test("updater rejects a manifest version that differs from the package", async () => {
  await withAssetResponse(zipData, async () => {
    await assert.rejects(
      loadRemoteSkillFiles(skillUpdaterConfig, validRelease, { version: 3 }),
      /does not match skill-release-manifest\.json version/u
    );
  });
});

test("updater rejects a remote package owned by another skill", async () => {
  const wrongRemoteZipData = zipSync({
    [`${skillName}/SKILL.md`]: Buffer.from(
      skillMarkdown(2, "# Different remote skill", "different-skill")
    )
  });
  await withAssetResponse(wrongRemoteZipData, async () => {
    await assert.rejects(
      loadRemoteSkillFiles(skillUpdaterConfig, validRelease, { version: 2 }),
      /identifies skill "different-skill" in SKILL\.md, but this updater expects "ai-ready-docs"/u
    );
  });
});

test("updater rejects aliased non-canonical package paths", async () => {
  const aliasedRemoteZipData = zipSync({
    [`${skillName}/SKILL.md`]: Buffer.from(remoteSkillMarkdown),
    [`${skillName}/references/../SKILL.md`]: Buffer.from(
      skillMarkdown(2, "# Must not replace the validated entry")
    )
  });
  await withAssetResponse(aliasedRemoteZipData, async () => {
    await assert.rejects(
      loadRemoteSkillFiles(skillUpdaterConfig, validRelease, { version: 2 }),
      /non-canonical skill path/u
    );
  });
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
  assert.match(invalidRelease.stderr, /GitHub release response .* is invalid/u);
  assert.match(invalidRelease.stderr, /assets/u);
});

test("updater reports invalid manifest payloads", async () => {
  await withAssetResponse(Buffer.from("{}"), async () => {
    await assert.rejects(
      resolveRemoteSkillPackage(skillUpdaterConfig, validRelease),
      /contains invalid skill-release-manifest\.json:[\s\S]*schemaVersion/u
    );
  });
});
