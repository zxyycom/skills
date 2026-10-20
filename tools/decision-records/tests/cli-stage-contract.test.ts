import { withGitFixtureWorkspace } from "./support-git-fixture.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createCliProgram } from "../src/cli-args.ts";
import {
  currentDecisionId,
  currentSourcePath,
  runSourceCli,
  runGit,
  fs,
  decisionFilePath
} from "./stage/support.ts";
test("help exposes stage independently without adding lifecycle stage options", () => {
  const program = createCliProgram(
    async () => 0,
    () => undefined
  );
  assert.match(program.helpInformation(), /stage \[options\] <selector\.\.\.>/);
  for (const command of [
    "publish",
    "evolve",
    "archive",
    "mark-aligned",
    "discard"
  ]) {
    const entry = program.commands.find(
      (candidate) => candidate.name() === command
    );
    assert.ok(entry);
    assert.doesNotMatch(entry.helpInformation(), /--stage/);
  }
});

test("help exposes the stage scope contract", () => {
  const program = createCliProgram(
    async () => 0,
    () => undefined
  );
  const stage = program.commands.find(
    (candidate) => candidate.name() === "stage"
  );
  assert.ok(stage);
  assert.match(stage.helpInformation(), /--scope <scope>/u);
  assert.match(
    stage.helpInformation(),
    /"all", "index", "domain", default: "all"/u
  );
});

test("stage rejects an invalid scope as a normal invalid argument", async () => {
  const args = ["stage", currentDecisionId, "--scope", "everything"];
  const staged = await runSourceCli(args);
  assert.equal(staged.exitCode, 2);
  assert.equal(staged.stdout, "");
  assert.match(staged.stderr, /Allowed choices are all, index, domain/u);
  let dispatched = false;
  const program = createCliProgram(
    async () => {
      dispatched = true;
      throw new Error("Invalid scope must not dispatch stage");
    },
    () => {},
    { io: { stdout: () => {}, stderr: () => {} } }
  );
  await assert.rejects(
    program.parseAsync(["node", "decision-records.ts", ...args]),
    /Allowed choices are all, index, domain/u
  );
  assert.equal(dispatched, false);
});

test("Decision stage argv preserves suffix normalization scope dispatch and caller-owned pending bytes", async () => {
  await withGitFixtureWorkspace("stage-argv-contract", async (root) => {
    const file = decisionFilePath(root, currentSourcePath);
    await fs.appendFile(file, "\n- CLI scope dispatch modification\n");
    const sync = await runSourceCli(["sync-index", "--root", root]);
    assert.equal(sync.exitCode, 0, sync.stderr);
    const index = await runSourceCli([
      "stage",
      "use-generated-cli.MD",
      "--scope",
      "index",
      "--root",
      root
    ]);
    assert.equal(index.exitCode, 0, index.stderr);
    assert.match(index.stdout, /scope: index/);
    assert.equal(
      runGit(root, ["diff", "--cached", "--name-only"]).trim(),
      "docs/decisions/decision-index.json"
    );
    const before = runGit(root, [
      "show",
      ":docs/decisions/decision-index.json"
    ]);
    const domain = await runSourceCli([
      "stage",
      currentDecisionId,
      "--scope",
      "domain",
      "--root",
      root
    ]);
    assert.equal(domain.exitCode, 0, domain.stderr);
    assert.match(domain.stdout, /scope: domain/);
    assert.match(
      domain.stdout,
      /caller-owned paths: docs\/decisions\/decision-index\.json/
    );
    assert.equal(
      runGit(root, ["show", ":docs/decisions/decision-index.json"]),
      before
    );
    assert.match(
      runGit(root, ["show", `:docs/decisions/${currentSourcePath}`]),
      /CLI scope dispatch modification/
    );
  });
});
