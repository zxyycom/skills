import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { assert, archivedDecisionId, runSourceCli, test } from "./support.ts";

test("set-relations rejects incomplete and mixed relation groups at the CLI boundary", async () => {
  const workspaceRoot = path.join(
    os.tmpdir(),
    `decision-cli-args-${randomUUID()}`
  );
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
      message: /--source requires at least one --relation or --clear-relations/
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
});

test("set-relations help documents the shared source-grouped relation syntax", async () => {
  const workspaceRoot = path.join(
    os.tmpdir(),
    `decision-cli-args-${randomUUID()}`
  );
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
});
