import {
  assert,
  archivedDecisionId,
  currentRelativePath,
  runSourceCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("set-relations rejects incomplete and mixed relation groups at the CLI boundary", () =>
  withFixtureWorkspace("set-relations-cli-args", async (workspaceRoot) => {
    for (const { args, message } of [
      {
        args: ["--relation", "修订=" + archivedDecisionId],
        message: /set-relations requires at least one --source group/
      },
      {
        args: [
          "--relation",
          "修订=" + archivedDecisionId,
          "--source",
          "use-generated-cli"
        ],
        message: /must follow --source/
      },
      {
        args: ["--source", "use-generated-cli"],
        message:
          /--source requires at least one --relation or --clear-relations/
      },
      {
        args: [
          "--source",
          "use-generated-cli",
          "--clear-relations",
          "--relation-summary",
          archivedDecisionId + "=说明"
        ],
        message:
          /--clear-relations cannot be used with --relation or --relation-summary/
      },
      {
        args: [
          "--source",
          "use-generated-cli",
          "--relation-summary",
          archivedDecisionId + "=说明"
        ],
        message: /--relation-summary requires at least one --relation/
      },
      {
        args: [
          "--source",
          "use-generated-cli",
          "--relation",
          "修订=" + archivedDecisionId,
          "--source",
          "use-generated-cli.md",
          "--relation",
          "修订=" + archivedDecisionId
        ],
        message: /--source must not repeat a Decision selector/
      },
      {
        args: [
          "--source",
          "use-generated-cli",
          "--relation",
          "修订=" + archivedDecisionId,
          "--relation",
          "替代=" + archivedDecisionId
        ],
        message:
          /must not repeat a direct predecessor target within one relation group/
      }
    ] as const) {
      const result = await runSourceCli([
        "set-relations",
        ...args,
        "--root",
        workspaceRoot
      ]);
      assert.equal(result.exitCode, 2, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.match(result.stderr, message, args.join(" "));
    }
  }));

test("evolve and set-relations reject the removed --relations-for option as an unknown option", () =>
  withFixtureWorkspace(
    "set-relations-removed-option",
    async (workspaceRoot) => {
      for (const command of ["set-relations", "evolve"] as const) {
        const args =
          command === "evolve"
            ? [
                "evolve",
                "--successor",
                "aligned=" + currentRelativePath,
                "--relations-for",
                currentRelativePath
              ]
            : ["set-relations", "--relations-for", currentRelativePath];
        const result = await runSourceCli([
          ...args,
          "--relation",
          "修订=" + archivedDecisionId,
          "--root",
          workspaceRoot
        ]);
        assert.equal(result.exitCode, 2, command);
        assert.match(
          result.stderr,
          /unknown option '--relations-for'/u,
          command
        );
      }
    }
  ));

test("set-relations help documents the shared source-grouped relation syntax", () =>
  withFixtureWorkspace("set-relations-help", async (workspaceRoot) => {
    const result = await runSourceCli([
      "set-relations",
      "--help",
      "--root",
      workspaceRoot
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /--source <decision-selector>/u);
    assert.match(result.stdout, /--clear-relations/u);
    assert.match(
      result.stdout,
      /--relation-summary <decision-selector=summary>/u
    );
    assert.doesNotMatch(result.stdout, /--relations-for/u);
  }));
