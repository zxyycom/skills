import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { unzipSync } from "fflate";
import {
  calculateSkillPackageSnapshotHash,
  collectSkillPackageFileSets,
  readPendingSkillPackageSnapshot,
  readSkillPackageSnapshotVersionBaseline
} from "../skill-package-hash.ts";
import { packSkillPackageSnapshot } from "../skill-package-release.ts";
import {
  createSkillRepositoryFixture,
  gitTestOptions,
  runGit,
  withTempRoot
} from "./skill-package-hash-test-support.ts";

test(
  "forced pending installation artifacts never enter package hashes or archives",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaDirectory, repositoryRoot, skills } =
        await createSkillRepositoryFixture(tempRoot);
      runGit(repositoryRoot, ["reset", "--hard", "HEAD"]);
      await fs.rm(path.join(alphaDirectory, "untracked.txt"));
      const before = await readPendingSkillPackageSnapshot(repositoryRoot);
      const paths = [
        "node_modules/package/index.js",
        "nested/node_modules/package/index.js",
        ".pnpm/package/index.js",
        "nested/.pnpm-store/store-file",
        ".npm/cache-file",
        "nested/.yarn/cache-file",
        ".cache/cache-file",
        "nested/.bun/cache-file"
      ];
      for (const filePath of paths) {
        const target = path.join(alphaDirectory, filePath);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, "local installation state\n");
      }
      await fs.symlink(
        "../.pnpm/package",
        path.join(alphaDirectory, "node_modules/linked-package")
      );
      runGit(repositoryRoot, ["add", "--force", "skills/alpha"]);
      const snapshot = await readPendingSkillPackageSnapshot(repositoryRoot);
      assert.deepEqual(snapshot.filesBySkill, before.filesBySkill);
      assert.deepEqual(
        calculateSkillPackageSnapshotHash(snapshot),
        calculateSkillPackageSnapshotHash(before)
      );
      const collected = await collectSkillPackageFileSets(skills);
      assert.deepEqual(
        collected.get("alpha"),
        before.filesBySkill.get("alpha")
      );
      const distDirectory = path.join(tempRoot, "dist");
      await packSkillPackageSnapshot(snapshot, distDirectory);
      const entries = unzipSync(
        await fs.readFile(path.join(distDirectory, "alpha.zip"))
      );
      assert.deepEqual(
        Object.keys(entries).sort(),
        (before.filesBySkill.get("alpha") ?? [])
          .map((file) => `alpha/${file.path}`)
          .sort()
      );

      // An old tracked installation must not create a version-bearing deletion.
      runGit(repositoryRoot, ["commit", "-m", "installation fixture"]);
      for (const directory of [
        "node_modules",
        "nested",
        ".pnpm",
        ".npm",
        ".cache"
      ]) {
        await fs.rm(path.join(alphaDirectory, directory), {
          recursive: true,
          force: true
        });
      }
      runGit(repositoryRoot, ["add", "-A"]);
      assert.deepEqual(
        (
          await readSkillPackageSnapshotVersionBaseline(
            await readPendingSkillPackageSnapshot(repositoryRoot),
            "HEAD",
            repositoryRoot
          )
        ).skills,
        {}
      );
    });
  }
);

test(
  "formal package symbolic links fail closed before hashing or packing",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { alphaDirectory, repositoryRoot, skills } =
        await createSkillRepositoryFixture(tempRoot);
      await fs.symlink("SKILL.md", path.join(alphaDirectory, "formal-link"));
      runGit(repositoryRoot, ["add", "skills/alpha/formal-link"]);
      await assert.rejects(
        readPendingSkillPackageSnapshot(repositoryRoot),
        /not a symbolic link: skills\/alpha\/formal-link/
      );
      await assert.rejects(
        collectSkillPackageFileSets(skills),
        /not a symbolic link: skills\/alpha\/formal-link/
      );
    });
  }
);
