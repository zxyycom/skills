import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  archivedRelativePath,
  currentRelativePath,
  generatedCliPath
} from "./support.ts";

function runGeneratedCli(args: readonly string[]) {
  return spawnSync("node", [generatedCliPath, ...args], { encoding: "utf8" });
}

test("decision CLI top-level help exposes the current command set", () => {
  const help = runGeneratedCli(["--help"]);
  assert.equal(help.status, 0);
  assert.match(
    help.stdout,
    /Query and maintain agent-oriented decision records/
  );
  assert.match(help.stdout, /This is the default command/);
  assert.match(
    help.stdout,
    /sync-index\s+Rebuild the JSON index from established\s+Markdown/
  );
  assert.match(
    help.stdout,
    /candidates remain outside the index and are queried from source/i
  );
  assert.match(
    help.stdout,
    /candidates\s+Discover complete reviewable candidates/i
  );
  assert.match(
    help.stdout,
    /show-candidate <decision-id>\s+Show one source-discovered candidate/i
  );
  assert.match(
    help.stdout,
    /evolve \[options\]\s+Replace complete successor relations/i
  );
  assert.doesNotMatch(help.stdout, /^\s*split(?:\s|$)/m);
});

test("sync-index rebuilds without an option and rejects the former write flag", () => {
  const help = runGeneratedCli(["sync-index", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Rebuild the JSON index from established Markdown/);
  assert.doesNotMatch(help.stdout, /--write/);

  const legacyFlag = runGeneratedCli(["sync-index", "--write"]);
  assert.equal(legacyFlag.status, 2);
  assert.equal(legacyFlag.stdout, "");
  assert.match(legacyFlag.stderr, /unknown option '--write'/);
});

test("archive help promises to preserve the last alignment", () => {
  const help = runGeneratedCli(["archive", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /preserving their last alignment/);
});

test("discard help requires an explicit recorded decision deletion flag", () => {
  const help = runGeneratedCli(["discard", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--delete-recorded-decision/);
  assert.match(help.stdout, /Decision ID that has entered\s+Git HEAD/);
});

test("evolve rejects a recorded-decision deletion flag without discard", () => {
  const result = runGeneratedCli([
    "evolve",
    "--successor",
    "aligned=use-successor.md",
    "--delete-recorded-decision"
  ]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /--delete-recorded-decision requires --discard <decision-id>/
  );
});

test("mark-aligned help requires verified current facts", () => {
  const help = runGeneratedCli(["mark-aligned", "--help"]);
  assert.equal(help.status, 0);
  assert.match(
    help.stdout,
    /only after its complete\s+direction\s+has become current fact\s+and been verified against the relevant\s+fact sources/
  );
});

test("evolve help exposes successor and complete relation selection", () => {
  const help = runGeneratedCli(["evolve", "--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--successor <alignment=decision-id>/);
  assert.match(help.stdout, /--clear-relations/);
  assert.match(help.stdout, /--discard <decision-id>/);
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
      "修订=" + currentRelativePath
    ]
  ]) {
    assert.equal(runGeneratedCli(args).status, 2);
  }
});

test("evolve requires at least one successor argument", () => {
  for (const args of [
    ["evolve"],
    ["evolve", "--discard", currentRelativePath]
  ]) {
    const result = runGeneratedCli(args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /required option '--successor/);
  }
});

test("relation and clear-relations options are mutually exclusive", () => {
  const result = runGeneratedCli([
    "activate",
    currentRelativePath,
    "--alignment",
    "aligned",
    "--relation",
    "修订=" + archivedRelativePath,
    "--clear-relations"
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /cannot be used with option/);
});

test("decision CLI rejects unknown options", () => {
  for (const args of [
    ["list", "--unknown-option"],
    ["archive", currentRelativePath, "--unknown-option"]
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
    "-1"
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
    "aligned=" + successorRelativePath
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
    "替代=" + currentRelativePath
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must not repeat a direct predecessor target/);
});

test("decision CLI rejects removed domain and path query protocols", () => {
  const help = runGeneratedCli(["--help"]);
  assert.doesNotMatch(help.stdout, /\bdomains\b/);
  assert.doesNotMatch(help.stdout, /--domain/);
  for (const { args, stderr } of [
    { args: ["domains"], stderr: /too many arguments/ },
    {
      args: ["list", "--domain", "decision-records"],
      stderr: /unknown option/
    },
    {
      args: ["show", "archive/use-generated-cli.md"],
      stderr: /Decision ID is invalid/
    },
    {
      args: [
        "list",
        "--tag",
        "decision-records",
        "--tag-or",
        "project-tooling"
      ],
      stderr: /unknown option/
    },
    {
      args: [
        "list",
        "--tag",
        "decision-records",
        "--not-tag",
        "project-tooling"
      ],
      stderr: /unknown option/
    }
  ]) {
    const result = runGeneratedCli(args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, stderr, args.join(" "));
  }
});

test("positional Decision IDs are validated at every CLI command boundary", () => {
  for (const args of [
    ["activate", "invalid_name.md", "--alignment", "aligned"],
    ["archive", "invalid_name.md"],
    ["discard", "invalid_name.md"],
    ["mark-aligned", "invalid_name.md"],
    ["show", "invalid_name.md"],
    ["show-candidate", "invalid_name.md"],
    ["stage", "invalid_name.md"],
    ["trace", "invalid_name.md"]
  ]) {
    const result = runGeneratedCli(args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(
      result.stderr,
      /Decision ID is invalid; must be a basename ending in \.md/,
      args.join(" ")
    );
  }
});
