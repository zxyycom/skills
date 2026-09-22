import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { test } from "node:test";
import { runInvestigationReportCheckCli } from "../src/cli.ts";
import { createInvestigationCliProgram } from "../src/cli-program.ts";
import { withTempRoot, writeCollection } from "./v6-support.ts";

type CliExecution = Readonly<{
  status: number;
  stderr: string;
  stdout: string;
}>;

async function runCli(
  args: readonly string[],
  options: { cwd?: string } = {}
): Promise<CliExecution> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = await runInvestigationReportCheckCli([...args], {
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
    io: {
      stderr: (text) => stderr.push(text),
      stdout: (text) => stdout.push(text)
    }
  });
  return { status, stderr: stderr.join(""), stdout: stdout.join("") };
}

test("investigation CLI accepts global options before and after the command", async () => {
  await withTempRoot("cli-global-option-positions", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const before = await runCli(["--root", root, "check"]);
    assert.equal(before.status, 0, before.stderr);
    assert.match(before.stdout, /1 of 1 reports checked/u);

    const after = await runCli(["check", "--root", root]);
    assert.equal(after.status, 0, after.stderr);
    assert.match(after.stdout, /1 of 1 reports checked/u);

    const bothSides = await runCli([
      "--root",
      root,
      "check",
      "--investigations-dir",
      "docs/investigations"
    ]);
    assert.equal(bothSides.status, 0, bothSides.stderr);
  });
});

test("investigation CLI defaults the workspace root to the current directory", async () => {
  await withTempRoot("cli-cwd-default", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runCli(["check"], { cwd: root });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 of 1 reports checked/u);
  });
});

test("investigation CLI renders help without reading the collection", async () => {
  await withTempRoot("cli-help-without-collection", async (root) => {
    const topLevel = await runCli(["--help"], { cwd: root });
    assert.equal(topLevel.status, 0);
    assert.equal(topLevel.stderr, "");
    assert.match(topLevel.stdout, /Usage: investigation-report/u);
    assert.match(topLevel.stdout, /Exit status: 0 success; 1/u);

    const helpCommand = await runCli(["help"], { cwd: root });
    assert.equal(helpCommand.status, 0);
    assert.match(helpCommand.stdout, /Usage: investigation-report/u);

    const commandHelp = await runCli(["check", "--help"], { cwd: root });
    assert.equal(commandHelp.status, 0);
    assert.equal(commandHelp.stderr, "");
    assert.match(commandHelp.stdout, /Usage: investigation-report check/u);
    assert.match(commandHelp.stdout, /--id <investigation-id>/u);
    assert.doesNotMatch(commandHelp.stdout, /set-relations/u);

    const namedCommandHelp = await runCli(["help", "sync-index"], {
      cwd: root
    });
    assert.equal(namedCommandHelp.status, 0);
    assert.match(
      namedCommandHelp.stdout,
      /Usage: investigation-report sync-index/u
    );
  });
});

test("investigation CLI without a command renders top-level help as an argument error", async () => {
  await withTempRoot("cli-missing-command", async (root) => {
    const missingCommand = await runCli([], { cwd: root });
    assert.equal(missingCommand.status, 2);
    assert.equal(missingCommand.stdout, "");
    assert.match(
      missingCommand.stderr,
      /Check, query, and maintain flat Investigation Report records/u
    );
    assert.match(missingCommand.stderr, /help \[command\]/u);

    const helpCommand = await runCli(["help"], { cwd: root });
    assert.equal(helpCommand.status, 0);
    assert.match(
      helpCommand.stdout,
      /Check, query, and maintain flat Investigation Report records/u
    );
  });
});

test("investigation CLI rejects absolute and escaping investigation directories", async () => {
  await withTempRoot("cli-dir-boundary", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    for (const investigationsDir of [
      "/tmp/investigations",
      "../investigations"
    ]) {
      const result = await runCli([
        "check",
        "--root",
        root,
        "--investigations-dir",
        investigationsDir
      ]);
      assert.equal(result.status, 2, investigationsDir);
      assert.equal(result.stdout, "", investigationsDir);
      assert.match(
        result.stderr,
        /--investigations-dir must (?:be relative|remain within)/u,
        investigationsDir
      );
    }
  });
});

test("investigation CLI reports the recovery form for a collection directory passed as root", async () => {
  await withTempRoot("cli-collection-root", async (root) => {
    await writeCollection(root, [{ id: "report" }]);

    const defaultDirectory = await runCli([
      "check",
      "--root",
      path.join(root, "docs", "investigations")
    ]);
    assert.equal(defaultDirectory.status, 2);
    assert.equal(defaultDirectory.stdout, "");
    assert.match(
      defaultDirectory.stderr,
      /--root <workspace> --investigations-dir docs\/investigations/u
    );

    const configuredDirectory = await runCli([
      "check",
      "--root",
      path.join(root, "notes"),
      "--investigations-dir",
      "notes"
    ]);
    assert.equal(configuredDirectory.status, 2);
    assert.match(
      configuredDirectory.stderr,
      /--root <workspace> --investigations-dir notes/u
    );

    const lookalikeDirectory = await runCli([
      "check",
      "--root",
      path.join(root, "mydocs", "investigations")
    ]);
    assert.equal(lookalikeDirectory.status, 1);
    assert.doesNotMatch(lookalikeDirectory.stderr, /Use --root <workspace>/u);
  });
});

test("investigation CLI normalizes the configured relative investigations directory", async () => {
  let investigationsDir: string | null = null;
  const program = createInvestigationCliProgram(
    async (input) => {
      investigationsDir = input.values.get("investigations-dir")?.[0] ?? null;
      return 0;
    },
    () => {},
    {
      cwd: path.join(process.cwd(), "investigation-report-cli-cwd"),
      io: { stderr: () => {}, stdout: () => {} }
    }
  );

  await program.parseAsync([
    "node",
    "check-investigations.mjs",
    "check",
    "--investigations-dir",
    "./docs/investigations/"
  ]);

  assert.equal(investigationsDir, "docs/investigations");
});

test("investigation CLI rejects removed commands and options as plain unknown input", async () => {
  await withTempRoot("cli-plain-unknown-input", async (root) => {
    await writeCollection(root, [{ id: "report" }]);

    const unknownCommand = await runCli(["topics"], { cwd: root });
    assert.equal(unknownCommand.status, 2);
    assert.equal(unknownCommand.stdout, "");
    assert.match(unknownCommand.stderr, /unknown command 'topics'/u);

    const unknownOption = await runCli(["list", "--category", "legacy"], {
      cwd: root
    });
    assert.equal(unknownOption.status, 2);
    assert.equal(unknownOption.stdout, "");
    assert.match(unknownOption.stderr, /unknown option '--category'/u);

    for (const result of [unknownCommand, unknownOption]) {
      assert.doesNotMatch(
        result.stderr,
        /deprecat|mi[gc]rat|legacy|旧的|迁移/u
      );
    }
  });
});

test("investigation CLI checks a custom relative investigations directory from another directory", async () => {
  await withTempRoot("cli-custom-relative-dir", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const result = await runCli(
      ["check", "--root", root, "--investigations-dir", "docs/investigations"],
      { cwd: os.tmpdir() }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 of 1 reports checked/u);
  });
});
