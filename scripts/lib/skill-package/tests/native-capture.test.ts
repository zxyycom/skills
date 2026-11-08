import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { captureNativeCandidateSnapshot } from "../../record-native/capture.ts";
import {
  createSkillRepositoryFixture,
  fileData,
  gitTestOptions,
  runGit,
  withTempRoot
} from "./skill-package-hash-test-support.ts";

test(
  "native release captures skill and source bytes from one pending basis",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, alphaStaged } =
        await createSkillRepositoryFixture(tempRoot);
      await assert.rejects(
        captureNativeCandidateSnapshot(repositoryRoot),
        /missing Cargo.toml/
      );
      const source = path.join(repositoryRoot, "tools/record-cli");
      await fs.mkdir(path.join(source, "src"), { recursive: true });
      for (const [name, content] of Object.entries({
        "Cargo.lock": "locked\n",
        "Cargo.toml": "toml\n",
        "rust-toolchain.toml": "toolchain\n",
        "src/main.rs": "staged\n"
      }))
        await fs.writeFile(path.join(source, name), content);
      await fs.mkdir(
        path.join(repositoryRoot, "tools/record-contracts/schemas"),
        { recursive: true }
      );
      const schema = path.join(
        repositoryRoot,
        "tools/record-contracts/schemas/index.json"
      );
      await fs.writeFile(schema, "staged schema");
      await fs.mkdir(path.join(repositoryRoot, "scripts/lib"), {
        recursive: true
      });
      await fs.writeFile(
        path.join(repositoryRoot, "scripts/lib/oxc-config.ts"),
        "staged config"
      );
      runGit(repositoryRoot, [
        "add",
        "scripts/lib/oxc-config.ts",
        "tools/record-cli",
        "tools/record-contracts"
      ]);
      await fs.writeFile(schema, "worktree schema");
      await fs.writeFile(path.join(source, "src/main.rs"), "worktree\n");
      const captured = await captureNativeCandidateSnapshot(repositoryRoot);
      assert.equal(
        fileData(
          captured.skills.filesBySkill.get("alpha") ?? [],
          "SKILL.md"
        ).toString(),
        alphaStaged
      );
      assert.equal(
        fileData(captured.delivery, "scripts/lib/oxc-config.ts").toString(),
        "staged config"
      );
      assert.equal(
        fileData(
          captured.delivery,
          "tools/record-contracts/schemas/index.json"
        ).toString(),
        "staged schema"
      );
      assert.equal(
        fileData(captured.source, "src/main.rs").toString(),
        "staged\n"
      );
      assert.equal(
        captured.sourceHash,
        "85d408aa404d16262b16a143dd0895adf62d1a6e6dee0781bcbe3db07bf25f63"
      );
      await fs.writeFile(path.join(source, "src/main.rs"), "restaged\n");
      runGit(repositoryRoot, ["add", "tools/record-cli/src/main.rs"]);
      assert.equal(
        fileData(captured.delivery, "scripts/lib/oxc-config.ts").toString(),
        "staged config"
      );
      assert.equal(
        fileData(
          captured.delivery,
          "tools/record-contracts/schemas/index.json"
        ).toString(),
        "staged schema"
      );
      assert.equal(
        fileData(captured.source, "src/main.rs").toString(),
        "staged\n"
      );
      assert.notEqual(
        (await captureNativeCandidateSnapshot(repositoryRoot)).sourceHash,
        captured.sourceHash
      );
      if (process.platform !== "win32") {
        await fs.symlink("main.rs", path.join(source, "src/link.rs"));
        runGit(repositoryRoot, ["add", "tools/record-cli/src/link.rs"]);
        await assert.rejects(
          captureNativeCandidateSnapshot(repositoryRoot),
          /must be regular/
        );
      }
    });
  }
);
