import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  runGeneratedInvestigationCli,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("CLI exposes only report-level commands and rejects old topic options", async () => {
  await withTempRoot("cli", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const help = runGeneratedInvestigationCli(root, ["--help"]);
    assert.equal(help.status, 0);
    assert.equal(help.stderr, "");
    assert.match(help.stdout, /set-relations --source <investigation-id>/u);
    assert.doesNotMatch(help.stdout, /--category/u);

    const oldOption = runGeneratedInvestigationCli(root, [
      "list",
      "--category",
      "legacy"
    ]);
    assert.equal(oldOption.status, 2);
    assert.equal(oldOption.stdout, "");
    assert.match(oldOption.stderr, /unknown option: --category/u);
  });
});

test("CLI set-relations parses source groups and reports JSON result", async () => {
  await withTempRoot("cli-relations", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const result = runGeneratedInvestigationCli(root, [
      "set-relations",
      "--source",
      "next.md",
      "--relation",
      "补充=base.md",
      "--json"
    ]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(parseJsonObject(result.stdout), {
      changed: true,
      errors: [],
      indexPath: `${investigationRoot(root)}/investigation-index.json`,
      sourceIds: ["next.md"]
    });
    const markdown = await fs.readFile(
      path.join(investigationRoot(root), "next.md"),
      "utf8"
    );
    assert.match(markdown, /type: "补充"\n    target: "base\.md"/u);
  });
});

test("CLI set-relations rejects relations that do not follow a source", async () => {
  await withTempRoot("cli-relations-invalid", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const malformed = runGeneratedInvestigationCli(root, [
      "set-relations",
      "--relation",
      "补充=base.md"
    ]);
    assert.equal(malformed.status, 2);
    assert.equal(malformed.stdout, "");
    assert.match(malformed.stderr, /--relation must follow --source/u);
  });
});

test("CLI leaves relation and trace enum values for API validation", async () => {
  await withTempRoot("cli-raw-enums", async (root) => {
    await writeCollection(root, [{ id: "base.md" }, { id: "next.md" }]);
    const relation = runGeneratedInvestigationCli(root, [
      "set-relations",
      "--source",
      "next.md",
      "--relation",
      "unknown=base.md"
    ]);
    assert.equal(relation.status, 1);
    assert.equal(relation.stdout, "");
    assert.match(relation.stderr, /relation type/u);

    const trace = runGeneratedInvestigationCli(root, [
      "trace",
      "--direction",
      "sideways",
      "next.md"
    ]);
    assert.equal(trace.status, 1);
    assert.equal(trace.stdout, "");
    assert.match(trace.stderr, /direction/u);
  });
});

test("CLI check succeeds on a current report collection", async () => {
  await withTempRoot("cli-check", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = runGeneratedInvestigationCli(root, ["check"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /1 of 1 reports checked; full index current/u);
  });
});

test("CLI sync-index writes a missing derived index", async () => {
  await withTempRoot("cli-sync", async (root) => {
    await writeCollection(root, [{ id: "report.md" }], false);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    await assert.rejects(fs.access(indexPath));
    const result = runGeneratedInvestigationCli(root, ["sync-index"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(
      result.stdout,
      /Investigation index synchronized \(1 reports\)\./u
    );
    const index = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    assert.ok(Object.hasOwn(jsonObjectMember(index, "entries"), "report.md"));
  });
});

test("CLI list returns a current report after resource byte changes", async () => {
  await withTempRoot("cli-resource", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "before", "utf8");
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    await fs.writeFile(resource, "after", "utf8");

    const result = runGeneratedInvestigationCli(root, ["list"]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /^report\.md /mu);
  });
});

test("CLI uses invalid-option exit status for malformed list input", async () => {
  await withTempRoot("cli-invalid", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = runGeneratedInvestigationCli(root, [
      "list",
      "--limit",
      "zero"
    ]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /limit must be a number/u);
  });
});

test("CLI stage-index uses invalid-option exit status without report IDs", async () => {
  await withTempRoot("cli-stage-invalid", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await fs.readFile(indexPath, "utf8");
    const result = runGeneratedInvestigationCli(root, ["stage-index"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(
      result.stderr,
      /stage-index requires at least one Investigation ID/u
    );
    assert.equal(await fs.readFile(indexPath, "utf8"), before);
  });
});

test("CLI show requires one Investigation ID", async () => {
  await withTempRoot("cli-show", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = runGeneratedInvestigationCli(root, ["show"]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /show requires exactly one Investigation ID/u);
  });
});

test("CLI trace accepts report-level direction options", async () => {
  await withTempRoot("cli-trace", async (root) => {
    await writeCollection(root, [
      { id: "first.md" },
      {
        id: "second.md",
        relations: [{ target: "first.md", type: "补充" }]
      }
    ]);
    const result = runGeneratedInvestigationCli(root, [
      "trace",
      "--direction",
      "successors",
      "first.md"
    ]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Reports: first\.md, second\.md/u);
    assert.match(result.stdout, /second\.md --补充--> first\.md/u);
  });
});
