import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateDecisionRecords } from "../src/index.ts";
import {
  fixtureRoot,
  initializeGitRepository,
  runSuccessfulSourceCli
} from "./support.ts";

const fixtureDecisionsDirectory = path.join(fixtureRoot, "docs", "decisions");

const relativeConfigurationRoot = await fs.mkdtemp(
  path.join(os.tmpdir(), "decision-records-relative-directory-")
);
try {
  const configuredPath = path.join("configuration", "decision-memory");
  const decisionsDirectory = path.join(relativeConfigurationRoot, configuredPath);
  await fs.mkdir(path.dirname(decisionsDirectory), { recursive: true });
  await fs.cp(fixtureDecisionsDirectory, decisionsDirectory, { recursive: true });
  initializeGitRepository(relativeConfigurationRoot);

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
  await fs.cp(fixtureDecisionsDirectory, decisionsDirectory, { recursive: true });
  initializeGitRepository(absoluteConfigurationRoot);
  assert.ok(path.relative(workspaceRoot, decisionsDirectory).startsWith(".."));

  const validation = await validateDecisionRecords({
    decisionsDir: decisionsDirectory,
    workspaceRoot
  });
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.scan.decisionsDirectory, decisionsDirectory);
  assert.equal(
    validation.scan.indexRelativePath,
    path.join(decisionsDirectory, "decision-index.json")
  );
  assert.match(
    await runSuccessfulSourceCli([
      "check",
      "--decisions-dir",
      decisionsDirectory,
      "--root",
      workspaceRoot
    ]),
    /Decision records check passed/
  );
} finally {
  await fs.rm(absoluteConfigurationRoot, { force: true, recursive: true });
}
