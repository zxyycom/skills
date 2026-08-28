import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { stageInvestigationIndex } from "../src/staging.ts";
import {
  investigationRoot,
  jsonObjectMember,
  parseJsonObject,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

const indexRelativePath = "docs/investigations/investigation-index.json";

function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function initializeGit(root: string): void {
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["add", "."]);
  git(root, ["commit", "--quiet", "-m", "initial"]);
}

test("stage-index selects entries by Investigation ID without staging reports", async () => {
  await withTempRoot("stage", async (root) => {
    await writeCollection(root, [{ id: "stage-report.md" }]);
    initializeGit(root);
    const result = await stageInvestigationIndex({
      reportIds: ["stage-report.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.deepEqual(result.selectedIds, ["stage-report.md"]);
  });
});

test("stage-index rejects invalid or duplicate Investigation IDs", async () => {
  await withTempRoot("stage-invalid", async (root) => {
    await writeCollection(root, [{ id: "stage-report.md" }]);
    const result = await stageInvestigationIndex({
      reportIds: [
        "stage-report.md",
        "stage-report.md",
        "bad/path.md",
        "./stage-report.md",
        " stage-report.md "
      ],
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "investigation-report.stage-report-id-duplicate"
      )
    );
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "investigation-report.stage-report-id-invalid"
      )
    );
  });
});

test("stage-index validates canonical Investigation IDs before repository access", async () => {
  await withTempRoot("stage-before-repository", async (root) => {
    const missingRoot = path.join(root, "missing-workspace");
    const result = await stageInvestigationIndex({
      reportIds: ["bad/path.md"],
      workspaceRoot: missingRoot
    });
    assert.equal(result.status, "error");
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "investigation-report.stage-report-id-invalid"
      )
    );
    await assert.rejects(fs.access(missingRoot));
  });
});

test("stage-index reports unavailable version control without working-tree writes", async () => {
  await withTempRoot("stage-no-git", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const reportPath = path.join(investigationRoot(root), "report.md");
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = await Promise.all(
      [reportPath, indexPath].map(
        async (file) => await fs.readFile(file, "utf8")
      )
    );
    const result = await stageInvestigationIndex({
      reportIds: ["report.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.deepEqual(
      await Promise.all(
        [reportPath, indexPath].map(
          async (file) => await fs.readFile(file, "utf8")
        )
      ),
      before
    );
  });
});

test("stage-index rejects IDs missing from the current collection", async () => {
  await withTempRoot("stage-missing", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = await stageInvestigationIndex({
      reportIds: ["missing.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
  });
});

test("stage-index keeps report Markdown outside selected index staging", async () => {
  await withTempRoot("stage-isolation", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    initializeGit(root);
    await writeCollection(root, [{ id: "report.md", title: "Changed" }]);
    const workspaceIndex = await fs.readFile(
      `${investigationRoot(root)}/investigation-index.json`,
      "utf8"
    );
    const result = await stageInvestigationIndex({
      reportIds: ["report.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    assert.deepEqual(
      git(root, ["diff", "--cached", "--name-only"]).trim(),
      indexRelativePath
    );
    assert.equal(git(root, ["show", `:${indexRelativePath}`]), workspaceIndex);
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/report.md"]),
      ""
    );
    assert.notEqual(
      git(root, ["diff", "--", "docs/investigations/report.md"]),
      ""
    );
  });
});

test("stage-index accepts selected report additions in a current index", async () => {
  await withTempRoot("stage-add", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    initializeGit(root);
    await writeCollection(root, [{ id: "report.md" }, { id: "added.md" }]);
    const workspaceIndex = parseJsonObject(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      )
    );
    const workspaceEntries = jsonObjectMember(workspaceIndex, "entries");
    const addedMarkdown = await fs.readFile(
      `${investigationRoot(root)}/added.md`,
      "utf8"
    );
    const result = await stageInvestigationIndex({
      reportIds: ["added.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    assert.deepEqual(result.selectedIds, ["added.md"]);
    const pendingIndex = parseJsonObject(
      git(root, ["show", `:${indexRelativePath}`])
    );
    assert.deepEqual(
      jsonObjectMember(pendingIndex, "entries")["added.md"],
      workspaceEntries["added.md"]
    );
    assert.deepEqual(
      git(root, ["diff", "--cached", "--name-only"]).trim(),
      indexRelativePath
    );
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/added.md"]),
      ""
    );
    assert.equal(
      await fs.readFile(`${investigationRoot(root)}/added.md`, "utf8"),
      addedMarkdown
    );
  });
});

test("stage-index treats resource byte changes as outside report selection", async () => {
  await withTempRoot("stage-resource-byte", async (root) => {
    const resourcePath = `${investigationRoot(root)}/_resources/report/evidence.txt`;
    await fs.mkdir(`${investigationRoot(root)}/_resources/report`, {
      recursive: true
    });
    await fs.writeFile(resourcePath, "before", "utf8");
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    initializeGit(root);
    const cachedBefore = git(root, ["diff", "--cached", "--binary"]);
    const indexBefore = await fs.readFile(
      `${investigationRoot(root)}/investigation-index.json`,
      "utf8"
    );
    await fs.writeFile(resourcePath, "after", "utf8");
    const result = await stageInvestigationIndex({
      reportIds: ["report.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, false);
    assert.equal(git(root, ["diff", "--cached", "--binary"]), cachedBefore);
    assert.equal(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      ),
      indexBefore
    );
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/report.md"]),
      ""
    );
    assert.notEqual(
      git(root, [
        "diff",
        "--",
        "docs/investigations/_resources/report/evidence.txt"
      ]),
      ""
    );
  });
});

test("stage-index treats unrelated report resources as outside selected report entries", async () => {
  await withTempRoot("stage-unrelated", async (root) => {
    const resourcePath = `${investigationRoot(root)}/_resources/second/evidence.txt`;
    await fs.mkdir(`${investigationRoot(root)}/_resources/second`, {
      recursive: true
    });
    await fs.writeFile(resourcePath, "before", "utf8");
    await writeCollection(root, [
      { id: "first.md" },
      { id: "second.md", resources: ["second/evidence.txt"] }
    ]);
    initializeGit(root);
    await writeCollection(root, [
      { id: "first.md", title: "Changed first" },
      { id: "second.md", resources: ["second/evidence.txt"] }
    ]);
    const workspaceIndex = parseJsonObject(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      )
    );
    const workspaceEntries = jsonObjectMember(workspaceIndex, "entries");
    const baseIndex = parseJsonObject(
      git(root, ["show", `HEAD:${indexRelativePath}`])
    );
    const baseEntries = jsonObjectMember(baseIndex, "entries");
    await fs.writeFile(resourcePath, "after", "utf8");
    const result = await stageInvestigationIndex({
      reportIds: ["first.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "ok");
    assert.equal(result.changed, true);
    const pendingIndex = parseJsonObject(
      git(root, ["show", `:${indexRelativePath}`])
    );
    const pendingEntries = jsonObjectMember(pendingIndex, "entries");
    assert.deepEqual(pendingEntries["first.md"], workspaceEntries["first.md"]);
    assert.deepEqual(pendingEntries["second.md"], baseEntries["second.md"]);
    assert.deepEqual(
      git(root, ["diff", "--cached", "--name-only"]).trim(),
      indexRelativePath
    );
    assert.equal(
      git(root, ["diff", "--cached", "--", "docs/investigations/first.md"]),
      ""
    );
    assert.equal(
      git(root, [
        "diff",
        "--cached",
        "--",
        "docs/investigations/_resources/second/evidence.txt"
      ]),
      ""
    );
    assert.notEqual(
      git(root, [
        "diff",
        "--",
        "docs/investigations/_resources/second/evidence.txt"
      ]),
      ""
    );
  });
});

test("stage-index preserves strict current index definition requirements", async () => {
  await withTempRoot("stage-definition", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    initializeGit(root);
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    const cachedBefore = git(root, ["diff", "--cached", "--binary"]);
    const stagedBefore = git(root, ["show", `:${indexRelativePath}`]);
    const invalidIndex = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    invalidIndex["definitionVersion"] = 5;
    const invalidText = `${JSON.stringify(invalidIndex, null, 2)}\n`;
    await fs.writeFile(indexPath, invalidText, "utf8");
    const result = await stageInvestigationIndex({
      reportIds: ["report.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.ok(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "state-index.definition-version-mismatch"
      )
    );
    assert.equal(git(root, ["diff", "--cached", "--binary"]), cachedBefore);
    assert.equal(git(root, ["show", `:${indexRelativePath}`]), stagedBefore);
    assert.equal(await fs.readFile(indexPath, "utf8"), invalidText);
  });
});

test("stage-index reports selection diagnostics deterministically", async () => {
  await withTempRoot("stage-diagnostics", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = await stageInvestigationIndex({
      reportIds: [],
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
    assert.equal(result.diagnostics.length > 0, true);
  });
});

test("stage-index does not accept legacy topic path identifiers", async () => {
  await withTempRoot("stage-legacy-path", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const result = await stageInvestigationIndex({
      reportIds: ["category/report.md"],
      workspaceRoot: root
    });
    assert.equal(result.status, "error");
  });
});
