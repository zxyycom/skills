import {
  archivedRelativePath,
  assert,
  currentRelativePath,
  runCli,
  runNodeCli,
  test
} from "./support.ts";

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

test("list and search reject repeated relation query options", async () => {
  for (const [command, prefix] of [
    ["list", []],
    ["search", ["text"]]
  ] as const) {
    for (const [option, first, second] of [
      ["--related-to", "first", "second"],
      ["--direction", "both", "successors"],
      ["--relation-type", "修订", "替代"]
    ] as const) {
      const result = await runCli([
        command,
        ...prefix,
        option,
        first,
        option,
        second
      ]);
      assert.equal(result.exitCode, 2, `${command} ${option}`);
      assert.equal(result.stdout, "", `${command} ${option}`);
      assert.match(
        result.stderr,
        new RegExp(`${option} must not be repeated`),
        `${command} ${option}`
      );
    }
  }
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
  assert.match(result.stderr, /must not repeat a successor Decision selector/);
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
      stderr: /Decision selector is invalid/
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
      /Decision selector is invalid; must be extensionless kebab-case text/,
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
