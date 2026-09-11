import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  calculateSkillPackageSnapshotHash,
  collectSkillPackageFileSets,
  readPendingSkillPackageSnapshot,
  readSkillPackageSnapshotVersionBaselineFromRepository,
  readSkillPackageVersion,
  readSkillPackageVersionBaseline
} from "./skill-package-hash.ts";
import { VersionControlError } from "../../tools/shared/src/version-control/index.ts";
import {
  createBaselineRepository,
  createSkillRepositoryFixture,
  fileData,
  gitTestOptions,
  runGit,
  skillMarkdown,
  skillPackageSnapshot,
  sortedPaths,
  withTempRoot
} from "./skill-package-hash-test-support.ts";

test(
  "collects sorted skill files from pending Git content",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaStaged, betaCommitted, skills, stagedBinary } =
        await createSkillRepositoryFixture(tempRoot);
      const filesBySkill = await collectSkillPackageFileSets(skills);
      const alphaFiles = filesBySkill.get("alpha") ?? [];
      const betaFiles = filesBySkill.get("beta") ?? [];

      assert.deepEqual(
        alphaFiles.map((file) => file.path),
        sortedPaths(["SKILL.md", "binary.bin", "nested/file with space.txt"])
      );
      assert.equal(
        fileData(alphaFiles, "SKILL.md").toString("utf8"),
        alphaStaged
      );
      assert.deepEqual(fileData(alphaFiles, "binary.bin"), stagedBinary);
      assert.equal(
        fileData(alphaFiles, "nested/file with space.txt").toString("utf8"),
        "nested staged\n"
      );
      assert.equal(
        alphaFiles.some((file) => file.path === "deleted.txt"),
        false
      );
      assert.equal(
        alphaFiles.some((file) => file.path === "untracked.txt"),
        false
      );
      assert.equal(readSkillPackageVersion("alpha", alphaFiles), 3);

      assert.deepEqual(
        betaFiles.map((file) => file.path),
        ["SKILL.md"]
      );
      assert.equal(
        fileData(betaFiles, "SKILL.md").toString("utf8"),
        betaCommitted
      );
      assert.equal(readSkillPackageVersion("beta", betaFiles), 7);
      assert.equal((await collectSkillPackageFileSets([])).size, 0);
    });
  }
);

test(
  "discovers skill membership from the same pending snapshot as its files",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { gammaDirectory, repositoryRoot } =
        await createSkillRepositoryFixture(tempRoot);
      const gammaMarkdown = skillMarkdown("gamma", 1, "gamma staged");
      await fs.mkdir(gammaDirectory, { recursive: true });
      await fs.writeFile(path.join(gammaDirectory, "SKILL.md"), gammaMarkdown);
      runGit(repositoryRoot, ["add", "skills/gamma/SKILL.md"]);
      await fs.rm(gammaDirectory, { force: true, recursive: true });

      const untrackedDirectory = path.join(
        repositoryRoot,
        "skills",
        "untracked"
      );
      await fs.mkdir(untrackedDirectory, { recursive: true });
      await fs.writeFile(
        path.join(untrackedDirectory, "SKILL.md"),
        skillMarkdown("untracked", 1, "working tree only")
      );

      const snapshot = await readPendingSkillPackageSnapshot(repositoryRoot);
      assert.deepEqual(
        snapshot.skills.map((skill) => skill.name),
        ["alpha", "beta", "gamma"]
      );
      assert.deepEqual(
        [...snapshot.filesBySkill.keys()],
        ["alpha", "beta", "gamma"]
      );
      assert.equal(
        fileData(snapshot.filesBySkill.get("gamma") ?? [], "SKILL.md").toString(
          "utf8"
        ),
        gammaMarkdown
      );
      assert.deepEqual(calculateSkillPackageSnapshotHash(snapshot).versions, {
        alpha: 3,
        beta: 7,
        gamma: 1
      });
      const baseline = await readSkillPackageVersionBaseline(
        snapshot.skills,
        "HEAD",
        repositoryRoot
      );
      assert.equal(baseline.revision.length, 40);
      assert.deepEqual(baseline.skills, { alpha: 3, gamma: null });
    });
  }
);

test(
  "reports missing or malformed skill version baselines",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, skills } =
        await createSkillRepositoryFixture(tempRoot);
      await assert.rejects(
        readSkillPackageVersionBaseline(
          skills,
          "missing-baseline",
          repositoryRoot
        ),
        (error: unknown) =>
          error instanceof VersionControlError &&
          error.code === "revision-not-found" &&
          error.causeCategory === "revision-unavailable" &&
          error.operation === "resolve a revision" &&
          error.target === "requested revision"
      );
    });

    const snapshot = skillPackageSnapshot({
      "SKILL.md": skillMarkdown("alpha", 3, "current")
    });
    await assert.rejects(
      readSkillPackageSnapshotVersionBaselineFromRepository(
        snapshot,
        "baseline",
        createBaselineRepository({
          "skills/alpha/SKILL.md": "---\nmetadata:\n  version: malformed\n---\n"
        })
      ),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes("frontmatter metadata.version") &&
        error.message.includes(
          "must be a string containing one positive integer"
        )
    );
  }
);
