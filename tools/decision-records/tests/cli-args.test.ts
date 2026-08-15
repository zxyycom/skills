import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  archivedRelativePath,
  currentRelativePath,
  generatedCliPath,
  runSourceCli,
} from "./support.ts";

function runGeneratedCli(args: readonly string[]) {
  return spawnSync("node", [generatedCliPath, ...args], { encoding: "utf8" });
}

test("decision CLI top-level help exposes the current command set", () => {
  const help = runGeneratedCli(["--help"]);
  assert.equal(help.status, 0);
  assert.match(
    help.stdout,
    /Query and maintain agent-oriented decision records/,
  );
  assert.match(help.stdout, /This is the default command/);
  assert.match(
    help.stdout,
    /Check the JSON index against established\s+Markdown/,
  );
  assert.match(
    help.stdout,
    /candidates remain outside the index and are queried from source/i,
  );
  assert.match(
    help.stdout,
    /candidates\s+Discover complete reviewable candidates/i,
  );
  assert.match(
    help.stdout,
    /show-candidate <decision-id>\s+Show one source-discovered candidate/i,
  );
  assert.match(
    help.stdout,
    /evolve \[options\]\s+Replace complete successor relations/i,
  );
  assert.doesNotMatch(help.stdout, /^\s*split(?:\s|$)/m);
});

test("archive help promises to preserve the last alignment", () => {
  const help = runGeneratedCli(["archive", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /preserving their last alignment/);
});

test("mark-aligned help requires verified current facts", () => {
  const help = runGeneratedCli(["mark-aligned", "--help"]);
  assert.equal(help.status, 0);
  assert.match(
    help.stdout,
    /only after its complete\s+direction\s+has become current fact\s+and been verified against the relevant\s+fact sources/,
  );
});

test("evolve help exposes successor and complete relation selection", () => {
  const help = runGeneratedCli(["evolve", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--successor <alignment=decision-id>/);
  assert.match(help.stdout, /--clear-relations/);
  assert.match(
    help.stdout,
    /resolved\s+source relations or --relation define the\s+complete final set, and --clear-relations\s+selects an explicitly empty set/,
  );
  assert.doesNotMatch(help.stdout, /--alignment <value>/);
});

test("decision CLI rejects removed split and positional evolve protocols", () => {
  for (const args of [
    ["split", currentRelativePath, "--successor", "aligned=use-successor.md"],
    [
      "evolve",
      "use-successor.md",
      "--alignment",
      "aligned",
      "--relation",
      "修订=" + currentRelativePath,
    ],
  ]) {
    assert.equal(runGeneratedCli(args).status, 2);
  }
});

test("evolve requires at least one successor argument", () => {
  const result = runGeneratedCli(["evolve"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /required option '--successor/);
});

test("relation and clear-relations options are mutually exclusive", () => {
  const result = runGeneratedCli([
    "activate",
    currentRelativePath,
    "--alignment",
    "aligned",
    "--relation",
    "修订=" + archivedRelativePath,
    "--clear-relations",
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /cannot be used with option/);
});

test("decision CLI rejects unknown options", () => {
  for (const args of [
    ["list", "--unknown-option"],
    ["archive", currentRelativePath, "--unknown-option"],
  ]) {
    const result = runGeneratedCli(args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /unknown option/);
  }
});

test("trace rejects a negative depth", () => {
  const result = runGeneratedCli([
    "trace",
    archivedRelativePath,
    "--depth",
    "-1",
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be a non-negative integer/);
});

test("list rejects an invalid tag token", () => {
  const result = runGeneratedCli(["list", "--tag", "Invalid_Tag"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be a kebab-case tag/);
});

test("activate requires an alignment argument", () => {
  const result = runGeneratedCli(["activate", currentRelativePath]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /required option '--alignment <value>'/);
});

test("evolve rejects duplicate successor members at the CLI boundary", () => {
  const successorRelativePath = "use-duplicate-successor.md";
  const result = runGeneratedCli([
    "evolve",
    "--successor",
    "aligned=" + successorRelativePath,
    "--successor",
    "aligned=" + successorRelativePath,
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must not repeat a successor Decision ID/);
});

test("evolve rejects repeated relation override targets at the CLI boundary", () => {
  const result = runGeneratedCli([
    "evolve",
    "--successor",
    "aligned=use-duplicate-relation.md",
    "--relation",
    "修订=" + currentRelativePath,
    "--relation",
    "替代=" + currentRelativePath,
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must not repeat a direct predecessor target/);
});

test("decision CLI rejects removed domain and path query protocols", async () => {
  const help = runGeneratedCli(["--help"]);
  assert.doesNotMatch(help.stdout, /\bdomains\b/);
  assert.doesNotMatch(help.stdout, /--domain/);
  for (const args of [
    ["domains"],
    ["list", "--domain", "decision-records"],
    ["show", "archive/use-generated-cli.md"],
    ["list", "--tag", "decision-records", "--tag-or", "project-tooling"],
    ["list", "--tag", "decision-records", "--not-tag", "project-tooling"],
  ]) {
    const result = await runSourceCli(args);
    assert.notEqual(result.exitCode, 0, args.join(" "));
  }
});
