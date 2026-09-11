import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { requireSuccess, run } from "./environment-test-process.ts";
import {
  commandPaths,
  createRepository,
  repositoryHookNames
} from "./environment-test-repository.ts";
import {
  createFakeToolPath,
  environmentWith,
  runEnvironment
} from "./environment-test-tools.ts";

test("environment check reports missing repository setup without writing it", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment check ")
  );
  try {
    const root = await createRepository(tempRoot, "unchecked repository");
    const fakeTools = await createFakeToolPath(tempRoot);
    const configBefore = run(
      "git",
      ["config", "--local", "--list"],
      root
    ).stdout;
    const modesBefore = await Promise.all(
      repositoryHookNames.map(
        async (hookName) =>
          (await fs.stat(path.join(root, ".githooks", hookName))).mode
      )
    );

    const check = runEnvironment(root, "check", fakeTools);

    assert.equal(check.status, 1);
    assert.match(check.stdout, /repository setup/u);
    assert.match(check.stdout, /environment\.js setup/u);
    assert.equal(
      run("git", ["config", "--local", "--list"], root).stdout,
      configBefore
    );
    assert.deepEqual(
      await Promise.all(
        repositoryHookNames.map(
          async (hookName) =>
            (await fs.stat(path.join(root, ".githooks", hookName))).mode
        )
      ),
      modesBefore
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("environment requires exact SCC without installing it", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment metrics ")
  );
  try {
    const root = await createRepository(tempRoot, "metrics repository");
    const readyTools = await createFakeToolPath(path.join(tempRoot, "ready"));
    const readySetup = runEnvironment(root, "setup", readyTools);
    requireSuccess(readySetup, "environment setup with ready metric tools");
    assert.match(readySetup.stdout, /\[ok\]\s+scc 4\.0\.0/u);

    const sccDirectories = new Set(
      commandPaths("scc").map((sccPath) => path.dirname(sccPath))
    );
    const pathWithoutScc = (process.env.PATH ?? "")
      .split(path.delimiter)
      .filter((directory) => !sccDirectories.has(directory))
      .join(path.delimiter);
    const missingTools = await createFakeToolPath(
      path.join(tempRoot, "missing"),
      { scc: "missing" }
    );
    const missingEnvironment = environmentWith(missingTools, pathWithoutScc);
    const missing = runEnvironment(
      root,
      "check",
      missingTools,
      missingEnvironment
    );
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /\[missing\]\s+scc/u);
    assert.match(
      missing.stdout,
      /Install SCC 4\.0\.0 with: go install github\.com\/boyter\/scc\/v4@v4\.0\.0/u
    );

    const missingRoot = await createRepository(
      tempRoot,
      "missing metrics repository"
    );
    const missingSetup = runEnvironment(
      missingRoot,
      "setup",
      missingTools,
      missingEnvironment
    );
    assert.equal(missingSetup.status, 1);
    assert.match(missingSetup.stderr, /does not install them/u);
    assert.equal(
      run("git", ["config", "--local", "--get", "core.hooksPath"], missingRoot)
        .status,
      1,
      "missing metric prerequisites must stop setup before repository writes"
    );

    const mismatchTools = await createFakeToolPath(
      path.join(tempRoot, "mismatch"),
      { scc: "mismatch" }
    );
    const mismatch = runEnvironment(root, "check", mismatchTools);
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stdout, /\[mismatch\]\s+scc 4\.0\.1/u);
    assert.match(mismatch.stdout, /expected 4\.0\.0/u);

    const probeFailureTools = await createFakeToolPath(
      path.join(tempRoot, "probe failure"),
      { scc: "probe-failure" }
    );
    const probeFailure = runEnvironment(root, "check", probeFailureTools);
    assert.equal(probeFailure.status, 1);
    assert.match(probeFailure.stdout, /\[error\]\s+scc/u);
    assert.match(probeFailure.stdout, /scc probe failed/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("environment requires the project Bun runtime minimum", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment Bun runtime ")
  );
  try {
    const root = await createRepository(tempRoot, "Bun runtime repository");
    const supportedTools = await createFakeToolPath(
      path.join(tempRoot, "supported"),
      { bunVersion: "1.3.14" }
    );
    const setup = runEnvironment(root, "setup", supportedTools);
    requireSuccess(setup, "environment setup with supported Bun");
    assert.match(setup.stdout, /\[ok\]\s+bun 1\.3\.14/u);
    requireSuccess(
      runEnvironment(root, "check", supportedTools),
      "environment check with supported Bun"
    );

    const outdatedTools = await createFakeToolPath(
      path.join(tempRoot, "outdated"),
      { bunVersion: "1.3.13" }
    );
    const outdated = runEnvironment(root, "check", outdatedTools);
    assert.equal(outdated.status, 1);
    assert.match(
      outdated.stdout,
      /\[outdated\]\s+bun 1\.3\.13 - requires >= 1\.3\.14/u
    );
    assert.match(
      outdated.stdout,
      /Environment is not ready\. Run: node scripts\/environment\.js setup/u
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("environment requires the Vibe Node runtime minimum", async () => {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills environment Node runtime ")
  );
  try {
    const root = await createRepository(tempRoot, "Node runtime repository");
    const supportedTools = await createFakeToolPath(
      path.join(tempRoot, "supported"),
      { nodeVersion: "24.18.0" }
    );
    const setup = runEnvironment(root, "setup", supportedTools);
    requireSuccess(setup, "environment setup with supported Node");
    assert.match(setup.stdout, /\[ok\]\s+node 24\.18\.0/u);
    requireSuccess(
      runEnvironment(root, "check", supportedTools),
      "environment check with supported Node"
    );

    const outdatedTools = await createFakeToolPath(
      path.join(tempRoot, "outdated"),
      { nodeVersion: "24.17.0" }
    );
    const outdated = runEnvironment(root, "check", outdatedTools);
    assert.equal(outdated.status, 1);
    assert.match(
      outdated.stdout,
      /\[outdated\]\s+node 24\.17\.0 - requires >= 24\.18\.0/u
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
