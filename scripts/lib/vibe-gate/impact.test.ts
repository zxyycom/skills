import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  baseGateCheckIds,
  gateActivationFlags,
  impactTagsForPath,
  prepareGateActivation,
  publishGateReceipts,
  validateBaseGateImpactContracts
} from "./impact.ts";

function runGit(directory: string, arguments_: readonly string[]): void {
  const result = spawnSync("git", arguments_, {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(
    result.status,
    0,
    `git ${arguments_.join(" ")} failed: ${result.stderr || result.stdout}`
  );
}

async function captureFixtureCommand(
  command: string,
  arguments_: readonly string[],
  cwd: string
): Promise<Buffer> {
  if (command !== "git") {
    return Buffer.from(JSON.stringify([command, arguments_]));
  }
  const result = spawnSync(command, arguments_, {
    cwd,
    windowsHide: true
  });
  if (result.status !== 0 || result.stdout === null) {
    throw new Error(
      `git ${arguments_.join(" ")} failed: ${String(result.stderr)}`
    );
  }
  return result.stdout;
}

async function writeFixture(
  directory: string,
  relativePath: string,
  contents: string
): Promise<void> {
  const target = path.join(directory, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, contents);
}

test("incremental Gate activates only checks without an exact successful input proof", async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills-gate-impact-")
  );
  const cacheDirectory = path.join(directory, ".log", "gate-cache");
  const passed = new Set(baseGateCheckIds);
  const captureDependencies = { captureCommand: captureFixtureCommand };
  try {
    await writeFixture(directory, ".gitignore", ".log/\n");
    await writeFixture(directory, "package.json", '{"private":true}\n');
    await writeFixture(directory, "docs/README.md", "# Fixture\n");
    await writeFixture(
      directory,
      "tools/change-plan/src/value.ts",
      "export const value = 1;\n"
    );
    await writeFixture(
      directory,
      "tools/shared/src/value.ts",
      "export const shared = 1;\n"
    );
    runGit(directory, ["init", "--quiet"]);
    runGit(directory, ["config", "user.email", "skills@example.test"]);
    runGit(directory, ["config", "user.name", "Skills Test"]);
    runGit(directory, ["add", "."]);
    runGit(directory, ["commit", "--quiet", "--message", "fixture"]);

    assert.deepEqual(validateBaseGateImpactContracts(), []);
    assert.equal(baseGateCheckIds.length, 35);
    const first = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.equal(first.kind, "incremental");
    assert.equal(first.activeCheckIds.length, baseGateCheckIds.length);
    assert.ok(first.decisions.every(({ action }) => action === "execute"));
    assert.deepEqual(
      await publishGateReceipts(first, passed, directory, captureDependencies),
      { published: true, receiptCount: 35 }
    );

    const warm = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.deepEqual(warm.activeCheckIds, []);
    assert.equal(
      warm.decisions.filter(({ action }) => action === "reuse").length,
      35
    );
    assert.deepEqual(gateActivationFlags(warm), []);

    await writeFixture(directory, "docs/README.md", "# Changed\n");
    const documentationChange = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.deepEqual(
      new Set(documentationChange.activeCheckIds),
      new Set(["markdown-link-validation", "secret-detection"])
    );
    assert.deepEqual(
      await publishGateReceipts(
        documentationChange,
        passed,
        directory,
        captureDependencies
      ),
      { published: true, receiptCount: 35 }
    );

    await writeFixture(
      directory,
      "tools/shared/src/value.ts",
      "export const shared = 2;\n"
    );
    const sharedChange = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.ok(
      sharedChange.activeCheckIds.includes(
        "test:change-plan:lifecycle-complete"
      )
    );
    assert.ok(sharedChange.activeCheckIds.includes("script:check:decisions"));
    assert.ok(sharedChange.activeCheckIds.includes("script:validate"));
    assert.deepEqual(
      await publishGateReceipts(
        sharedChange,
        passed,
        directory,
        captureDependencies
      ),
      {
        published: true,
        receiptCount: 35
      }
    );

    await writeFixture(
      directory,
      "tools/skill-package/src/value.ts",
      "export const packageValue = 1;\n"
    );
    const skillPackageChange = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.ok(
      skillPackageChange.activeCheckIds.includes("script:test:skill-updater")
    );
    assert.ok(
      skillPackageChange.activeCheckIds.includes("script:test:environment")
    );
    assert.ok(skillPackageChange.activeCheckIds.includes("script:validate"));
    assert.deepEqual(
      await publishGateReceipts(
        skillPackageChange,
        passed,
        directory,
        captureDependencies
      ),
      { published: true, receiptCount: 35 }
    );

    await writeFixture(
      directory,
      "scripts/lib/generated-file.ts",
      "export const generatedFile = 1;\n"
    );
    const buildSystemChange = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.ok(
      buildSystemChange.activeCheckIds.includes("script:test:generated-file")
    );
    assert.ok(
      buildSystemChange.activeCheckIds.includes(
        "test:change-plan:lifecycle-complete"
      )
    );
    assert.deepEqual(
      await publishGateReceipts(
        buildSystemChange,
        passed,
        directory,
        captureDependencies
      ),
      { published: true, receiptCount: 35 }
    );

    await writeFixture(directory, "unknown-owner.bin", "unknown\n");
    const unknownChange = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.equal(unknownChange.activeCheckIds.length, baseGateCheckIds.length);
    assert.ok(
      unknownChange.decisions.some(
        ({ reason }) => reason === "conservative-fallback"
      )
    );
    assert.deepEqual(
      await publishGateReceipts(
        unknownChange,
        passed,
        directory,
        captureDependencies
      ),
      {
        published: true,
        receiptCount: 35
      }
    );
    const stableUnknown = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.deepEqual(stableUnknown.activeCheckIds, []);

    await writeFixture(directory, "package.json", '{"private":false}\n');
    const configurationChange = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.equal(
      configurationChange.activeCheckIds.length,
      baseGateCheckIds.length
    );
    assert.deepEqual(
      await publishGateReceipts(
        configurationChange,
        passed,
        directory,
        captureDependencies
      ),
      { published: true, receiptCount: 35 }
    );
    const changedEnvironment = { GATE_FIXTURE: "changed", _: "first-parent" };
    const environmentChange = await prepareGateActivation({
      cacheDirectory,
      captureDependencies: {
        ...captureDependencies,
        environment: changedEnvironment
      },
      release: false,
      workspaceRoot: directory
    });
    assert.equal(
      environmentChange.activeCheckIds.length,
      baseGateCheckIds.length
    );
    assert.deepEqual(
      await publishGateReceipts(environmentChange, passed, directory, {
        ...captureDependencies,
        environment: changedEnvironment
      }),
      { published: true, receiptCount: 35 }
    );
    const shellBookkeepingChange = await prepareGateActivation({
      cacheDirectory,
      captureDependencies: {
        ...captureDependencies,
        environment: { ...changedEnvironment, _: "second-parent" }
      },
      release: false,
      workspaceRoot: directory
    });
    assert.deepEqual(shellBookkeepingChange.activeCheckIds, []);

    const changedToolchain = await prepareGateActivation({
      cacheDirectory,
      captureDependencies: {
        ...captureDependencies,
        async captureCommand(command, arguments_, cwd) {
          if (command === "bun" && arguments_[0] === "--version") {
            return Buffer.from("different Bun version");
          }
          return await captureFixtureCommand(command, arguments_, cwd);
        },
        environment: changedEnvironment
      },
      release: false,
      workspaceRoot: directory
    });
    assert.equal(changedToolchain.kind, "incremental");
    assert.equal(
      changedToolchain.activeCheckIds.length,
      baseGateCheckIds.length
    );

    const unavailableToolchain = await prepareGateActivation({
      cacheDirectory,
      captureDependencies: {
        ...captureDependencies,
        async captureCommand(command, arguments_, cwd) {
          if (command === "scc") throw new Error("scc probe failed");
          return await captureFixtureCommand(command, arguments_, cwd);
        }
      },
      release: false,
      workspaceRoot: directory
    });
    assert.equal(unavailableToolchain.kind, "fallback");
    assert.match(unavailableToolchain.fallbackDetail, /scc probe failed/u);
    assert.equal(
      unavailableToolchain.activeCheckIds.length,
      baseGateCheckIds.length
    );

    await fs.writeFile(
      path.join(cacheDirectory, "receipts.json"),
      '{"formatVersion":"corrupt"}\n'
    );
    const corrupt = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.equal(corrupt.activeCheckIds.length, baseGateCheckIds.length);
    assert.ok(
      corrupt.decisions.every(({ reason }) => reason === "cache-invalid")
    );
    assert.deepEqual(
      await publishGateReceipts(
        corrupt,
        new Set(),
        directory,
        captureDependencies
      ),
      { published: false, reason: "check-not-passed" }
    );
    const afterFailedRun = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    assert.ok(
      afterFailedRun.decisions.every(({ reason }) => reason === "cache-invalid")
    );
    assert.deepEqual(
      await publishGateReceipts(
        corrupt,
        passed,
        directory,
        captureDependencies
      ),
      { published: true, receiptCount: 35 }
    );

    const beforeDrift = await prepareGateActivation({
      cacheDirectory,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    const unavailableFinalSnapshot = await publishGateReceipts(
      beforeDrift,
      passed,
      directory,
      {
        ...captureDependencies,
        async captureCommand(command, arguments_, cwd) {
          if (command === "scc") throw new Error("final scc probe failed");
          return await captureFixtureCommand(command, arguments_, cwd);
        }
      }
    );
    assert.equal(unavailableFinalSnapshot.published, false);
    assert.equal(unavailableFinalSnapshot.reason, "snapshot-unavailable");
    assert.ok("detail" in unavailableFinalSnapshot);
    await fs.appendFile(path.join(directory, "docs", "README.md"), "drift\n");
    assert.deepEqual(
      await publishGateReceipts(
        beforeDrift,
        passed,
        directory,
        captureDependencies
      ),
      {
        published: false,
        reason: "workspace-drift"
      }
    );

    const cacheFile = path.join(directory, "not-a-directory");
    await fs.writeFile(cacheFile, "occupied\n");
    const unavailableCache = await prepareGateActivation({
      cacheDirectory: cacheFile,
      captureDependencies,
      release: false,
      workspaceRoot: directory
    });
    const unavailablePublication = await publishGateReceipts(
      unavailableCache,
      passed,
      directory,
      captureDependencies
    );
    assert.equal(unavailablePublication.published, false);
    assert.equal(unavailablePublication.reason, "publication-failed");
    assert.ok("detail" in unavailablePublication);

    const release = await prepareGateActivation({
      cacheDirectory,
      release: true,
      workspaceRoot: directory
    });
    assert.equal(release.kind, "release");
    assert.equal(release.activeCheckIds.length, 63);
    assert.ok(
      release.decisions.every(({ reason }) => reason === "release-full")
    );

    assert.deepEqual(impactTagsForPath("new-owner/value.bin"), {
      tags: ["global", "path-inventory"],
      unclassified: true
    });
    const nonRepository = await fs.mkdtemp(
      path.join(os.tmpdir(), "skills-gate-no-git-")
    );
    try {
      const fallback = await prepareGateActivation({
        cacheDirectory: path.join(nonRepository, ".log"),
        release: false,
        workspaceRoot: nonRepository
      });
      assert.equal(fallback.kind, "fallback");
      assert.match(fallback.fallbackDetail, /git ls-files/u);
      assert.equal(fallback.activeCheckIds.length, baseGateCheckIds.length);
    } finally {
      await fs.rm(nonRepository, { force: true, recursive: true });
    }
  } finally {
    await fs.rm(directory, { force: true, recursive: true });
  }
});
