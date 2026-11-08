import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { releaseSnapshotCheckId } from "../../lib/vibe-gate.ts";
import {
  createReleasePackageStage,
  packIsolatedSkillSnapshot
} from "../../lib/record-native/staging.ts";
import { readPendingSkillPackageSnapshot } from "../../lib/skill-package/skill-package-hash.ts";
import {
  packSkillPackageSnapshot,
  prepareSkillPackageRelease
} from "../../lib/skill-package/skill-package-release.ts";
import {
  createReleaseTestDefinition,
  createReleaseRepository,
  fileExists,
  outcomeFor,
  passingNativeChecks,
  runDefinition,
  stageSkillMarkdown,
  withTemporaryDirectory,
  zipSkillMarkdown
} from "./vibe-check-test-support.ts";

test("release authorization and package use the snapshot captured before the index changes", async () => {
  await withTemporaryDirectory(
    "skills-vibe-release-snapshot-",
    async (directory) => {
      await createReleaseRepository(directory, 2, "captured content");
      await stageSkillMarkdown(directory, 2, "captured content");
      let packCalls = 0;
      const result = await runDefinition(
        createReleaseTestDefinition({
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
          }
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
        createReleaseTestDefinition({
          nativeChecks: passingNativeChecks()
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
        createReleaseTestDefinition({
          nativeChecks: passingNativeChecks(),
          prepareRelease: async () => {
            throw new Error("Git resolver unavailable");
          }
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

test("release typed handoff retains the same private reference and never reuses it across Runs", async () => {
  await withTemporaryDirectory(
    "gate-release-private-handoff-",
    async (directory) => {
      await createReleaseRepository(directory);
      const references: object[] = [];
      let failPreparation = false;
      let packCalls = 0;
      const definition = createReleaseTestDefinition({
        prepareRelease: async (root, baseline) => {
          if (failPreparation) throw new Error("second Run preparation failed");
          const prepared = await prepareSkillPackageRelease(root, baseline);
          references.push(prepared);
          return prepared;
        },
        packRelease: async (prepared) => {
          packCalls += 1;
          assert.equal(prepared, references.at(-1));
        }
      });
      const first = await runDefinition(definition, directory, ["release"]);
      assert.equal(first.aggregate, "passed");
      assert.equal(JSON.stringify(first.snapshot).includes('"handoff"'), false);
      assert.equal(
        JSON.stringify(first.snapshot).includes('"snapshot"'),
        false
      );
      const second = await runDefinition(definition, directory, ["release"]);
      assert.equal(second.aggregate, "passed");
      assert.notEqual(references[0], references[1]);
      failPreparation = true;
      const failed = await runDefinition(definition, directory, ["release"]);
      assert.equal(failed.aggregate, "failed");
      assert.equal(packCalls, 2);
      assert.notEqual(outcomeFor(failed, "pack:skills").status, "passed");
    }
  );
});

test("release packaging failure and cancellation cannot produce successful delivery", async () => {
  const { run } = await import("@zxyycom/vibe-check");
  const { noOutput } = await import("./vibe-check-test-support.ts");
  await withTemporaryDirectory(
    "gate-release-final-failure-",
    async (directory) => {
      await createReleaseRepository(directory);
      const failed = await runDefinition(
        createReleaseTestDefinition({
          packRelease: async () => {
            throw new Error("fixture pack failed");
          }
        }),
        directory,
        ["release"]
      );
      assert.equal(outcomeFor(failed, "pack:skills").status, "failed");
      const controller = new AbortController();
      let packed = false;
      const cancelled = await run(
        createReleaseTestDefinition({
          prepareRelease: async (root, baseline) => {
            const prepared = await prepareSkillPackageRelease(root, baseline);
            controller.abort();
            return prepared;
          },
          packRelease: async () => {
            packed = true;
          }
        }),
        {
          flags: ["release"],
          projectRoot: directory,
          signal: controller.signal,
          outputs: noOutput
        }
      );
      assert.equal(cancelled.kind, "cancelled");
      assert.equal(packed, false);
    }
  );
});

test("release packaging isolates an exclusive stage and preserves existing dist outputs", async () => {
  await withTemporaryDirectory(
    "skills-vibe-isolated-release-",
    async (directory) => {
      await createReleaseRepository(directory, 2, "captured content");
      await stageSkillMarkdown(directory, 2, "captured content");
      const dist = path.join(directory, "dist");
      await assert.rejects(
        createReleasePackageStage(directory, "../unsafe"),
        /safe leaf/
      );
      assert.equal(await fileExists(dist), false);
      await fs.mkdir(path.join(dist, "skill-release"), { recursive: true });
      await fs.writeFile(path.join(dist, "sentinel"), "preserve");
      await fs.writeFile(
        path.join(dist, "skill-release", "previous"),
        "preserve stage"
      );
      const previous = process.env.SKILL_RELEASE_STAGE;
      process.env.SKILL_RELEASE_STAGE = "package-fixture";
      const snapshot = await readPendingSkillPackageSnapshot(directory);
      const originalRm = fs.rm;
      let concurrentRejected = false;
      fs.rm = async (target, options) => {
        await originalRm(target, options);
        if (
          String(target) ===
          path.join(dist, "skill-release", "package-fixture", "packages")
        ) {
          await assert.rejects(
            packIsolatedSkillSnapshot(snapshot, directory, "package-fixture"),
            { code: "EEXIST" }
          );
          concurrentRejected = true;
        }
      };
      try {
        const definition = createReleaseTestDefinition({
          nativeChecks: passingNativeChecks()
        });
        const first = await runDefinition(definition, directory, ["release"]);
        assert.equal(first.aggregate, "passed");
        assert.equal(concurrentRejected, true);
        const archive = path.join(
          dist,
          "skill-release",
          "package-fixture",
          "packages",
          "alpha.zip"
        );
        const bytes = await fs.readFile(archive);
        assert.ok(bytes.byteLength > 0);
        assert.equal(
          await fs.readFile(path.join(dist, "sentinel"), "utf8"),
          "preserve"
        );
        assert.equal(
          await fs.readFile(
            path.join(dist, "skill-release", "previous"),
            "utf8"
          ),
          "preserve stage"
        );
        const again = await runDefinition(definition, directory, ["release"]);
        assert.equal(outcomeFor(again, "pack:skills").status, "failed");
        assert.deepEqual(await fs.readFile(archive), bytes);
      } finally {
        fs.rm = originalRm;
        if (previous === undefined) delete process.env.SKILL_RELEASE_STAGE;
        else process.env.SKILL_RELEASE_STAGE = previous;
      }
    }
  );
});
