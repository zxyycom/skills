import { assert, createCliProgram, path, runCli, test } from "./support.ts";

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
    /sync-index[\s\S]*Check or rebuild the JSON index from[\s\S]*established Markdown/
  );
  assert.match(
    help.stdout,
    /candidates remain outside the index, are queried from source, and report scaffold and body readiness separately/i
  );
  assert.match(
    help.stdout,
    /Decision selectors remove one terminal \.md suffix, then resolve a calendar-valid YYMMDD-name ID exactly or a unique semantic name\./
  );
  assert.match(help.stdout, /candidates\s+Discover candidate scaffolds/i);
  assert.match(
    help.stdout,
    /show-candidate <selector>\s+Show one source-discovered candidate/i
  );
  assert.match(
    help.stdout,
    /new \[options\] <selector>\s+Create one non-overwriting candidate\s+scaffold/i
  );
  assert.match(
    help.stdout,
    /evolve \[options\]\s+Replace complete successor relations/i
  );
  assert.doesNotMatch(help.stdout, /^\s*split(?:\s|$)/m);
});

test("decision search help exposes full-text modes and structural filters", async () => {
  const help = await runCli(["search", "--help"]);
  assert.equal(help.exitCode, 0);
  for (const option of [
    "--match <mode>",
    "--in <scope>",
    "--alignment <value>",
    "--status <value>",
    "--tag <tag>",
    "--related-to <selector>",
    "--direction <value>",
    "--relation-type <type>"
  ]) {
    assert.ok(help.stdout.includes(option), option);
  }
  assert.match(help.stdout, /"all", "any", "phrase"/);
  assert.match(help.stdout, /"content", "metadata"/);
});

test("decision list help and argument boundary expose bounded recent query controls", async () => {
  const help = await runCli(["list", "--help"]);
  assert.equal(help.exitCode, 0);
  for (const option of [
    "--created-from <timestamp>",
    "--created-to <timestamp>",
    "--limit <count>",
    "--offset <count>",
    "--detail"
  ]) {
    assert.ok(help.stdout.includes(option), option);
  }
  assert.match(help.stdout, /default: 10, maximum: 1000/u);

  for (const args of [
    ["list", "--limit", "0"],
    ["list", "--limit", "1001"],
    ["list", "--offset", "-1"],
    ["list", "--created-from", "not-a-timestamp"],
    [
      "list",
      "--created-from",
      "2026-09-09T00:00:00Z",
      "--created-to",
      "2026-09-08T00:00:00Z"
    ]
  ]) {
    const result = await runCli(args);
    assert.equal(result.exitCode, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
  }

  for (const option of [
    "--created-from",
    "--created-to",
    "--limit",
    "--offset"
  ]) {
    const value = option.startsWith("--created") ? "2026-09-08T00:00:00Z" : "1";
    const result = await runCli(["list", option, value, option, value]);
    assert.equal(result.exitCode, 2, option);
    assert.equal(result.stdout, "", option);
    assert.match(result.stderr, new RegExp(`${option} must not be repeated`));
  }
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
    "--relation <type=decision-selector>",
    "--preflight-alignment <value>"
  ]) {
    assert.ok(help.stdout.includes(option), option);
  }
  assert.match(
    help.stdout,
    /Declare one direct predecessor relation\s+for this candidate/
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

test("sync-index exposes explicit selected scope and write controls", async () => {
  const help = await runCli(["sync-index", "--help"]);
  assert.equal(help.exitCode, 0);
  assert.match(
    help.stdout,
    /Check or rebuild the JSON index from established Markdown/
  );
  assert.match(help.stdout, /--select <name-or-id>/);
  assert.match(help.stdout, /--write/);

  const explicitWrite = await runCli(["sync-index", "--write"]);
  assert.notEqual(explicitWrite.exitCode, 2);
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
  assert.match(help.stdout, /--successor <alignment=decision-selector>/);
  assert.match(help.stdout, /--clear-relations/);
  assert.match(help.stdout, /--discard <selector>/);
  assert.doesNotMatch(help.stdout, /--alignment <value>/);
});
