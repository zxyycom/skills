import assert from "node:assert/strict";
import { test } from "node:test";
import { runInvestigationReportCheckCli } from "../src/cli.ts";
import { withTempRoot, writeCollection } from "./v6-support.ts";

test("CLI exposes only report-level commands and rejects old topic options", async () => {
  await withTempRoot("cli", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const oldOption = await runInvestigationReportCheckCli([
      "list",
      "--root",
      root,
      "--category",
      "legacy"
    ]);
    assert.equal(oldOption, 2);
    const list = await runInvestigationReportCheckCli([
      "list",
      "--root",
      root,
      "--tag",
      "investigation-report"
    ]);
    assert.equal(list, 0);
  });
});

test("CLI set-relations parses source groups and reports JSON result", async () => {
  await withTempRoot("cli-relations", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const result = await runInvestigationReportCheckCli([
      "set-relations",
      "--root",
      root,
      "--source",
      "next.md",
      "--relation",
      "补充=base.md",
      "--json"
    ]);
    assert.equal(result, 0);
    const malformed = await runInvestigationReportCheckCli([
      "set-relations",
      "--root",
      root,
      "--relation",
      "补充=base.md"
    ]);
    assert.equal(malformed, 2);
  });
});

test("CLI check succeeds on a current report collection", async () => {
  await withTempRoot("cli-check", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    assert.equal(
      await runInvestigationReportCheckCli(["check", "--root", root]),
      0
    );
  });
});

test("CLI sync-index writes a missing derived index", async () => {
  await withTempRoot("cli-sync", async (root) => {
    await writeCollection(root, [{ id: "report.md" }], false);
    assert.equal(
      await runInvestigationReportCheckCli(["sync-index", "--root", root]),
      0
    );
  });
});

test("CLI list returns a current report after resource byte changes", async () => {
  await withTempRoot("cli-resource", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    assert.equal(
      await runInvestigationReportCheckCli(["list", "--root", root]),
      0
    );
  });
});

test("CLI uses invalid-option exit status for malformed list input", async () => {
  await withTempRoot("cli-invalid", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    assert.equal(
      await runInvestigationReportCheckCli([
        "list",
        "--root",
        root,
        "--limit",
        "zero"
      ]),
      2
    );
  });
});

test("CLI stage-index uses invalid-option exit status without report IDs", async () => {
  await withTempRoot("cli-stage-invalid", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    assert.equal(
      await runInvestigationReportCheckCli(["stage-index", "--root", root]),
      2
    );
  });
});

test("CLI show requires one Investigation ID", async () => {
  await withTempRoot("cli-show", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    assert.equal(
      await runInvestigationReportCheckCli(["show", "--root", root]),
      2
    );
  });
});

test("CLI trace accepts report-level direction options", async () => {
  await withTempRoot("cli-trace", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    assert.equal(
      await runInvestigationReportCheckCli([
        "trace",
        "--root",
        root,
        "--direction",
        "both",
        "report.md"
      ]),
      0
    );
  });
});

test("CLI help documents report-level set-relations command", async () => {
  assert.equal(await runInvestigationReportCheckCli(["--help"]), 0);
});
