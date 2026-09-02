import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { createCliProgram } from "../src/cli-args.ts";
import { runDecisionRecordsCli } from "../src/cli.ts";
import {
  archivedRelativePath,
  currentRelativePath,
  generatedCliPath
} from "./support.ts";

type CliExecution = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

async function runCli(args: readonly string[]): Promise<CliExecution> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runDecisionRecordsCli(args, {
    io: {
      stderr: (text) => stderr.push(text),
      stdout: (text) => stdout.push(text)
    }
  });
  return { exitCode, stderr: stderr.join(""), stdout: stdout.join("") };
}

function runNodeCli(args: readonly string[]) {
  return spawnSync("node", [generatedCliPath, ...args], { encoding: "utf8" });
}

test("decision CLI resolves a relative root from injected cwd", async () => {
  const cwd = path.join(process.cwd(), "decision-records-cli-cwd");
  let workspaceRoot: string | null = null;
  const program = createCliProgram(
    async (args) => {
      workspaceRoot = args.workspaceRoot;
      return 0;
    },
    () => {},
    {
      cwd,
      io: { stderr: () => {}, stdout: () => {} }
    }
  );

  await program.parseAsync([
    "node",
    "decision-records.mjs",
    "check",
    "--root",
    "."
  ]);

  assert.equal(workspaceRoot, cwd);
});

test("decision CLI top-level help exposes the current command set", async () => {
  const help = await runCli(["--help"]);
  assert.equal(help.exitCode, 0);
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
    /candidates remain outside the index, are queried from source, and report scaffold and body readiness separately/i
  );
  assert.match(help.stdout, /candidates\s+Discover candidate scaffolds/i);
  assert.match(
    help.stdout,
    /show-candidate <decision-id>\s+Show one source-discovered candidate/i
  );
  assert.match(
    help.stdout,
    /new \[options\] <decision-id>\s+Create one non-overwriting candidate\s+scaffold/i
  );
  assert.match(
    help.stdout,
    /evolve \[options\]\s+Replace complete successor relations/i
  );
  assert.doesNotMatch(help.stdout, /^\s*split(?:\s|$)/m);
});

test("new help fixes explicit scaffold inputs without accepting lifecycle alignment", async () => {
  const help = await runCli(["new", "--help"]);
  assert.equal(help.exitCode, 0);
  for (const option of [
    "--title <text>",
    "--purpose <text>",
    "--background <text>",
    "--decision <text>",
    "--tag <tag>",
    "--relation <type=decision-id>",
    "--preflight-alignment <value>"
  ]) {
    assert.ok(help.stdout.includes(option), option);
  }
  assert.match(
    help.stdout,
    /Declare one direct predecessor relation for\s+this candidate/
  );
  assert.doesNotMatch(help.stdout, /selected successor/);
  assert.doesNotMatch(help.stdout, /--alignment <value>/);
  assert.match(
    help.stdout,
    /Scaffold readiness validates candidate structure; body readiness validates required nonempty sections and the 采用 field/
  );
});

test("activate and evolve preflight retain their real lifecycle selection options", async () => {
  for (const command of ["activate", "evolve"] as const) {
    const help = await runCli([command, "--help"]);
    assert.equal(help.exitCode, 0);
    assert.match(help.stdout, /--preflight/);
    assert.match(help.stdout, /or pending\s+state/);
  }
});

test("sync-index rebuilds without an option and rejects the former write flag", async () => {
  const help = await runCli(["sync-index", "--help"]);
  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /Rebuild the JSON index from established Markdown/);
  assert.doesNotMatch(help.stdout, /--write/);

  const legacyFlag = await runCli(["sync-index", "--write"]);
  assert.equal(legacyFlag.exitCode, 2);
  assert.equal(legacyFlag.stdout, "");
  assert.match(legacyFlag.stderr, /unknown option '--write'/);
});

test("archive help promises to preserve the last alignment", async () => {
  const help = await runCli(["archive", "--help"]);
  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /preserving their last alignment/);
});

test("discard help requires an explicit recorded decision deletion flag", async () => {
  const help = await runCli(["discard", "--help"]);
  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /--delete-recorded-decision/);
  assert.match(help.stdout, /Decision ID that has entered\s+Git HEAD/);
});

test("evolve rejects a recorded-decision deletion flag without discard", async () => {
  const result = await runCli([
    "evolve",
    "--successor",
    "aligned=use-successor.md",
    "--delete-recorded-decision"
  ]);
  assert.equal(result.exitCode, 2);
  assert.equal(result.stdout, "");
  assert.match(
    result.stderr,
    /--delete-recorded-decision requires --discard <decision-id>/
  );
});

test("mark-aligned help requires verified current facts", async () => {
  const help = await runCli(["mark-aligned", "--help"]);
  assert.equal(help.exitCode, 0);
  assert.match(
    help.stdout,
    /only after its complete\s+direction\s+has become current fact\s+and been verified against the relevant\s+fact sources/
  );
});

test("evolve help exposes successor and complete relation selection", async () => {
  const help = await runCli(["evolve", "--help"]);
  assert.equal(help.exitCode, 0);
  assert.match(help.stdout, /--successor <alignment=decision-id>/);
  assert.match(help.stdout, /--clear-relations/);
  assert.match(help.stdout, /--discard <decision-id>/);
  assert.doesNotMatch(help.stdout, /--alignment <value>/);
});

test("decision CLI rejects removed split and positional evolve protocols", async () => {
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
    assert.equal((await runCli(args)).exitCode, 2);
  }
});

test("evolve requires at least one successor argument", async () => {
  for (const args of [
    ["evolve"],
    ["evolve", "--discard", currentRelativePath]
  ]) {
    const result = await runCli(args);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /required option '--successor/);
  }
});

test("relation and clear-relations options are mutually exclusive", async () => {
  const result = await runCli([
    "activate",
    currentRelativePath,
    "--alignment",
    "aligned",
    "--relation",
    "修订=" + archivedRelativePath,
    "--clear-relations"
  ]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /cannot be used with option/);
});

test("decision CLI rejects unknown options", async () => {
  for (const args of [
    ["list", "--unknown-option"],
    ["archive", currentRelativePath, "--unknown-option"]
  ]) {
    const result = await runCli(args);
    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /unknown option/);
  }
});

test("trace rejects a negative depth", async () => {
  const result = await runCli(["trace", archivedRelativePath, "--depth", "-1"]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /must be a non-negative integer/);
});

test("list rejects an invalid tag token", async () => {
  const result = await runCli(["list", "--tag", "Invalid_Tag"]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /must be a kebab-case tag/);
});

test("activate requires an alignment argument", async () => {
  const result = await runCli(["activate", currentRelativePath]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /required option '--alignment <value>'/);
});

test("evolve rejects duplicate successor members at the CLI boundary", async () => {
  const successorRelativePath = "use-duplicate-successor.md";
  const result = await runCli([
    "evolve",
    "--successor",
    "aligned=" + successorRelativePath,
    "--successor",
    "aligned=" + successorRelativePath
  ]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /must not repeat a successor Decision ID/);
});

test("evolve rejects repeated relation override targets at the CLI boundary", async () => {
  const result = await runCli([
    "evolve",
    "--successor",
    "aligned=use-duplicate-relation.md",
    "--relation",
    "修订=" + currentRelativePath,
    "--relation",
    "替代=" + currentRelativePath
  ]);
  assert.equal(result.exitCode, 2);
  assert.match(result.stderr, /must not repeat a direct predecessor target/);
});

test("decision CLI rejects removed domain and path query protocols", async () => {
  const help = await runCli(["--help"]);
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
    const result = await runCli(args);
    assert.equal(result.exitCode, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(result.stderr, stderr, args.join(" "));
  }
});

test("positional Decision IDs are validated at every CLI command boundary", async () => {
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
    const result = await runCli(args);
    assert.equal(result.exitCode, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.match(
      result.stderr,
      /Decision ID is invalid; must be a basename ending in \.md/,
      args.join(" ")
    );
  }
});

test("generated Decision Records CLI preserves the Node success and failure protocol", () => {
  const success = runNodeCli(["--help"]);
  assert.equal(success.status, 0, success.stderr);
  assert.match(
    success.stdout,
    /Query and maintain agent-oriented decision records/
  );
  assert.equal(success.stderr, "");

  const failure = runNodeCli(["evolve"]);
  assert.equal(failure.status, 2);
  assert.equal(failure.stdout, "");
  assert.match(failure.stderr, /required option '--successor/);
});
