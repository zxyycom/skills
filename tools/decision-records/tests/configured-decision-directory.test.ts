import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateDecisionRecords } from "../src/index.ts";
import {
  fixtureRoot,
  runSourceCli,
  runSuccessfulSourceCli
} from "./support.ts";

test("relative decision directories resolve from the workspace root", async () => {
  const fixtureDecisionsDirectory = path.join(fixtureRoot, "docs", "decisions");

  const relativeConfigurationRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-relative-directory-")
  );
  try {
    const configuredPath = path.join("configuration", "decision-memory");
    const decisionsDirectory = path.join(
      relativeConfigurationRoot,
      configuredPath
    );
    await fs.mkdir(path.dirname(decisionsDirectory), { recursive: true });
    await fs.cp(fixtureDecisionsDirectory, decisionsDirectory, {
      recursive: true
    });
    await runSuccessfulSourceCli([
      "sync-index",
      "--decisions-dir",
      configuredPath,
      "--root",
      relativeConfigurationRoot
    ]);

    const validation = await validateDecisionRecords({
      decisionsDir: configuredPath,
      workspaceRoot: relativeConfigurationRoot
    });
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.scan.decisionsDirectory, decisionsDirectory);
    assert.equal(
      validation.scan.indexRelativePath,
      "configuration/decision-memory/decision-index.json"
    );
    assert.match(
      await runSuccessfulSourceCli([
        "check",
        "--decisions-dir",
        configuredPath,
        "--root",
        relativeConfigurationRoot
      ]),
      /Decision records check passed/
    );
  } finally {
    await fs.rm(relativeConfigurationRoot, { force: true, recursive: true });
  }
});

test("absolute decision directories fail as ordinary location errors", async () => {
  const absoluteConfigurationRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "decision-records-absolute-directory-")
  );
  try {
    const workspaceRoot = path.join(absoluteConfigurationRoot, "workspace");
    const decisionsDirectory = path.join(
      absoluteConfigurationRoot,
      "shared-decision-memory"
    );
    await fs.mkdir(workspaceRoot, { recursive: true });
    await fs.cp(
      path.join(fixtureRoot, "docs", "decisions"),
      decisionsDirectory,
      {
        recursive: true
      }
    );
    assert.ok(
      path.relative(workspaceRoot, decisionsDirectory).startsWith("..")
    );

    const validation = await validateDecisionRecords({
      decisionsDir: decisionsDirectory,
      workspaceRoot
    });
    assert.deepEqual(validation.errors, [
      "--decisions-dir must be relative to --root"
    ]);
    assert.equal(validation.scan.decisionsDirectoryAvailable, false);

    const escapingValidation = await validateDecisionRecords({
      decisionsDir: "../shared-decision-memory",
      workspaceRoot
    });
    assert.deepEqual(escapingValidation.errors, [
      "--decisions-dir must remain within --root"
    ]);

    const cli = await runSourceCli([
      "check",
      "--decisions-dir",
      decisionsDirectory,
      "--root",
      workspaceRoot
    ]);
    assert.equal(cli.exitCode, 2);
    assert.equal(cli.stdout, "");
    assert.match(cli.stderr, /--decisions-dir must be relative to --root/u);
  } finally {
    await fs.rm(absoluteConfigurationRoot, { force: true, recursive: true });
  }
});
