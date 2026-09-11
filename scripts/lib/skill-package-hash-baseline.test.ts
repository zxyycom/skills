import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  calculateSkillPackageSnapshotHash,
  getSkillPackageVersionIssues,
  readPendingSkillPackageSnapshot,
  readSkillPackageSnapshotVersionBaseline,
  readSkillPackageSnapshotVersionBaselineFromRepository,
  readSkillPackageVersionBaseline,
  type SkillPackageSnapshot
} from "./skill-package-hash.ts";
import { VersionControlError } from "../../tools/shared/src/version-control/index.ts";
import {
  alphaBaselineFiles,
  createBaselineRepository,
  createSkillRepositoryFixture,
  fixtureRepositoryRoot,
  gitTestOptions,
  readBaseline,
  runGit,
  skillFile,
  skillMarkdown,
  skillPackageSnapshot,
  withTempRoot
} from "./skill-package-hash-test-support.ts";

test(
  "version checks retain the captured pending snapshot after the index resets",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaDirectory, repositoryRoot } =
        await createSkillRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(
        path.join(alphaDirectory, "SKILL.md"),
        skillMarkdown("alpha", 3, "captured content-only change")
      );
      runGit(repositoryRoot, ["add", "skills/alpha/SKILL.md"]);
      const snapshot = await readPendingSkillPackageSnapshot(repositoryRoot);

      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);

      const baseline = await readSkillPackageSnapshotVersionBaseline(
        snapshot,
        "HEAD",
        repositoryRoot
      );
      assert.deepEqual(baseline.skills, { alpha: 3 });
      assert.match(
        getSkillPackageVersionIssues(
          calculateSkillPackageSnapshotHash(snapshot),
          baseline
        )[0] ?? "",
        /increase skills\/alpha\/SKILL\.md metadata\.version above 3/
      );
    });
  }
);

test("version checks stop reading baseline blobs after the first ordinary change", async () => {
  const baselineFiles = {
    ...alphaBaselineFiles(),
    "skills/alpha/a-changed.txt": "base\n",
    "skills/alpha/z-unreadable.txt": "base\n"
  };
  const snapshot = skillPackageSnapshot({
    "SKILL.md": skillMarkdown("alpha", 3, "unchanged"),
    "a-changed.txt": "changed\n",
    "z-unreadable.txt": "base\n"
  });
  const readPaths: string[] = [];
  const repository = createBaselineRepository(baselineFiles, { readPaths });
  const baseline = await readSkillPackageSnapshotVersionBaselineFromRepository(
    snapshot,
    "baseline",
    repository
  );

  assert.deepEqual(baseline.skills, { alpha: 3 });
  assert.equal(readPaths.includes("skills/alpha/z-unreadable.txt"), false);
  assert.match(
    getSkillPackageVersionIssues(
      calculateSkillPackageSnapshotHash(snapshot),
      baseline
    )[0] ?? "",
    /increase skills\/alpha\/SKILL\.md metadata\.version above 3/
  );
});

test("accepts a new skill at initial version one", async () => {
  const snapshot: SkillPackageSnapshot = {
    filesBySkill: new Map([
      ["alpha", [skillFile("SKILL.md", skillMarkdown("alpha", 4, "changed"))]],
      ["gamma", [skillFile("SKILL.md", skillMarkdown("gamma", 1, "new"))]]
    ]),
    skills: [
      {
        directory: path.join(fixtureRepositoryRoot, "skills", "alpha"),
        name: "alpha"
      },
      {
        directory: path.join(fixtureRepositoryRoot, "skills", "gamma"),
        name: "gamma"
      }
    ]
  };
  const baseline = await readBaseline(snapshot, alphaBaselineFiles());
  assert.deepEqual(baseline.skills, { alpha: 3, gamma: null });
  assert.deepEqual(
    getSkillPackageVersionIssues(
      calculateSkillPackageSnapshotHash(snapshot),
      baseline
    ),
    []
  );
});

test(
  "reports corrupt baseline skill blobs as operation failures",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaDirectory: skillDirectory, repositoryRoot } =
        await createSkillRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.writeFile(path.join(skillDirectory, "changed.txt"), "changed\n");
      await fs.writeFile(
        path.join(skillDirectory, "SKILL.md"),
        skillMarkdown("alpha", 3, "pending")
      );
      runGit(repositoryRoot, ["add", "skills/alpha/changed.txt"]);
      runGit(repositoryRoot, ["add", "skills/alpha/SKILL.md"]);

      const blobId = runGit(repositoryRoot, [
        "rev-parse",
        "HEAD:skills/alpha/SKILL.md"
      ]).trim();
      const blobPath = path.join(
        repositoryRoot,
        ".git",
        "objects",
        blobId.slice(0, 2),
        blobId.slice(2)
      );
      await fs.chmod(blobPath, 0o666);
      await fs.writeFile(blobPath, "corrupt Git object", "utf8");

      await assert.rejects(
        readSkillPackageVersionBaseline(
          [{ directory: skillDirectory, name: "alpha" }],
          "HEAD",
          repositoryRoot
        ),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "operation-failed" &&
          error.causeCategory === "command-failed" &&
          error.operation === "read a file from a revision" &&
          error.target === "skills/alpha/SKILL.md"
      );
    });
  }
);
