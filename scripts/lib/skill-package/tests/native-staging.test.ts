import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { stageNativeCandidateInputs } from "../../record-native/staging.ts";
import { buildStagedNativeCandidate } from "../../record-native/build.ts";
import { readPendingSkillPackageSnapshot } from "../skill-package-hash.ts";
import {
  createSkillRepositoryFixture,
  gitTestOptions,
  withTempRoot
} from "./skill-package-hash-test-support.ts";

test(
  "native input staging leaves other dist outputs untouched",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createSkillRepositoryFixture(tempRoot);
      const dist = path.join(repositoryRoot, "dist");
      await fs.mkdir(dist);
      await fs.writeFile(path.join(dist, "sentinel"), "keep");
      const source = Object.entries({
        "Cargo.lock": "locked\n",
        "Cargo.toml": "toml\n",
        "rust-toolchain.toml": "toolchain\n",
        "src/main.rs": "staged\n"
      }).map(([path, text]) => ({ path, data: Buffer.from(text) }));
      const snapshot = {
        skills: await readPendingSkillPackageSnapshot(repositoryRoot),
        source,
        sourceHash:
          "85d408aa404d16262b16a143dd0895adf62d1a6e6dee0781bcbe3db07bf25f63"
      };
      const stage = await stageNativeCandidateInputs(repositoryRoot, snapshot);
      assert.equal(path.dirname(stage), path.join(dist, "skill-release"));
      assert.equal(
        await fs.readFile(path.join(stage, "source/src/main.rs"), "utf8"),
        "staged\n"
      );
      assert.equal(
        await fs.readFile(path.join(dist, "sentinel"), "utf8"),
        "keep"
      );
      assert.ok((await fs.stat(path.join(stage, "skills/alpha.zip"))).isFile());
      assert.ok(
        (
          await fs.stat(path.join(stage, "skills/skill-release-manifest.json"))
        ).isFile()
      );
      await assert.rejects(
        stageNativeCandidateInputs(repositoryRoot, {
          ...snapshot,
          sourceHash: "0".repeat(64)
        }),
        /digest changed/
      );
      assert.equal(
        await fs.readFile(path.join(dist, "sentinel"), "utf8"),
        "keep"
      );
    });
  }
);

test(
  "native build rejects changed staged source before running Cargo",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createSkillRepositoryFixture(tempRoot);
      const source = Object.entries({
        "Cargo.lock": "locked\n",
        "Cargo.toml": "toml\n",
        "rust-toolchain.toml": "toolchain\n",
        "src/main.rs": "staged\n"
      }).map(([path, text]) => ({ path, data: Buffer.from(text) }));
      const snapshot = {
        skills: await readPendingSkillPackageSnapshot(repositoryRoot),
        source,
        sourceHash:
          "85d408aa404d16262b16a143dd0895adf62d1a6e6dee0781bcbe3db07bf25f63"
      };
      const stage = await stageNativeCandidateInputs(repositoryRoot, snapshot);
      await fs.writeFile(path.join(stage, "source/src/main.rs"), "changed\n");
      await assert.rejects(
        buildStagedNativeCandidate(repositoryRoot, stage, "0.1.0"),
        /differs from its frozen manifest/
      );
      await assert.rejects(fs.lstat(path.join(stage, "target")), {
        code: "ENOENT"
      });
    });
  }
);
