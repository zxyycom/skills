import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createGateDefinition,
  releaseRequiredCheckIds,
  releaseSnapshotCheckId
} from "./lib/vibe-gate.ts";
import {
  packSkillPackageSnapshot,
  prepareSkillPackageRelease
} from "./lib/skill-package-release.ts";
import {
  completedScript,
  createReleaseRepository,
  fileExists,
  outcomeFor,
  passingNativeChecks,
  releaseTerminalCheck,
  runDefinition,
  stageSkillMarkdown,
  withTemporaryDirectory,
  zipSkillMarkdown
} from "./vibe-check-test-support.ts";

test("release prepare runs before terminal authorization and package", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-timing-",
    async (directory) => {
      await createReleaseRepository(directory);
      const definition = createGateDefinition(["release"], {
        baselineRef: "HEAD",
        batchReleaseTests: false,
        nativeChecks: passingNativeChecks(),
        runCommand: completedScript()
      });
      const prepare = definition.checks.find(
        ({ checkId }) => checkId === releaseSnapshotCheckId
      );
      const version = definition.checks.find(
        ({ checkId }) => checkId === "release:skill-version"
      );
      assert.deepEqual(prepare?.dependsOn ?? [], []);
      assert.deepEqual(version?.dependsOn, [
        ...releaseRequiredCheckIds,
        releaseSnapshotCheckId
      ]);
      assert.deepEqual(releaseTerminalCheck(definition).dependsOn, [
        "release:skill-version"
      ]);
      assert.equal(
        (await runDefinition(definition, directory, ["release"])).aggregate,
        "passed"
      );
    }
  );
});

test("release authorization and package use the snapshot captured before the index changes", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-snapshot-",
    async (directory) => {
      await createReleaseRepository(directory, 2, "captured content");
      await stageSkillMarkdown(directory, 2, "captured content");
      let packCalls = 0;
      const result = await runDefinition(
        createGateDefinition(["release"], {
          batchReleaseTests: false,
          nativeChecks: passingNativeChecks(),
          prepareRelease: async (workspaceRoot, baselineRef) => {
            const prepared = await prepareSkillPackageRelease(
              workspaceRoot,
              baselineRef
            );
            await stageSkillMarkdown(workspaceRoot, 3, "later index content");
            return prepared;
          },
          packRelease: async (prepared, workspaceRoot) => {
            packCalls += 1;
            return await packSkillPackageSnapshot(
              prepared.snapshot,
              path.join(workspaceRoot, "dist")
            );
          },
          runCommand: completedScript()
        }),
        directory,
        ["release"]
      );
      assert.equal(result.aggregate, "passed");
      assert.equal(packCalls, 1);
      assert.match(await zipSkillMarkdown(directory), /captured content/u);
      assert.match(
        await fs.readFile(
          path.join(directory, "skills", "alpha", "SKILL.md"),
          "utf8"
        ),
        /later index content/u
      );
    }
  );
});

test("release preparation or version failure blocks packaging", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-blocks-",
    async (directory) => {
      await createReleaseRepository(directory);
      await stageSkillMarkdown(
        directory,
        1,
        "content changed without version bump"
      );
      const versionFailed = await runDefinition(
        createGateDefinition(["release"], {
          batchReleaseTests: false,
          nativeChecks: passingNativeChecks(),
          runCommand: completedScript()
        }),
        directory,
        ["release"]
      );
      assert.equal(
        outcomeFor(versionFailed, "release:skill-version").status,
        "failed"
      );
      const versionMessages = versionFailed.checkMessages.filter(
        ({ checkId }) => checkId === "release:skill-version"
      );
      assert.ok(versionMessages.length > 1);
      assert.ok(
        versionMessages.every(
          ({ message }) => !/[\n\r\u2028\u2029]/u.test(message)
        )
      );
      assert.notEqual(
        outcomeFor(versionFailed, "pack:skills").status,
        "passed"
      );
      assert.equal(await fileExists(path.join(directory, "dist")), false);

      const unavailable = await runDefinition(
        createGateDefinition(["release"], {
          batchReleaseTests: false,
          nativeChecks: passingNativeChecks(),
          prepareRelease: async () => {
            throw new Error("Git resolver unavailable");
          },
          runCommand: completedScript()
        }),
        directory,
        ["release"]
      );
      assert.equal(
        outcomeFor(unavailable, releaseSnapshotCheckId).status,
        "unavailable"
      );
      assert.notEqual(outcomeFor(unavailable, "pack:skills").status, "passed");
    }
  );
});
