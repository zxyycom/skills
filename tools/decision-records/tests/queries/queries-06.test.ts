import os from "node:os";
import { projectDecisionMetadata } from "../../src/decision-query-search-metadata.ts";
import { printSearch } from "../../src/cli-output-search.ts";
import { listSnapshotEntries } from "./domain-support.ts";
import {
  archivedDecisionId,
  assert,
  candidateDecisionBody,
  currentDecisionId,
  currentSourcePath,
  decisionFilePath,
  fs,
  path,
  runSourceCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("decision metadata search matches published fields and source relation summaries", async () => {
  const decisionId = "metadata-source";
  const entries = await listSnapshotEntries([
    {
      id: decisionId,
      text: candidateDecisionBody({
        id: decisionId,
        relations: [
          {
            summary: "仅来源关联摘要",
            target: archivedDecisionId,
            type: "修订"
          }
        ],
        tags: ["metadata-tag"],
        title: "全角　ＭＥＴＡ字段"
      })
        .replace("status: candidate", "status: active")
        .replace("alignment: null", "alignment: aligned")
        .replace("createdAt: null", "createdAt: 2026-09-02T00:00:00Z")
    }
  ]);
  function renderMetadata(text: string, match: "all" | "phrase") {
    const result = projectDecisionMetadata(entries, {
      command: "search",
      in: "metadata",
      text,
      match,
      status: "active",
      alignment: "all",
      tags: [],
      location: { decisionsDir: "docs/decisions", workspaceRoot: os.tmpdir() }
    });
    assert.ok(result.status === "ok" && result.command === "search");
    let stdout = "";
    printSearch(result, {
      stdout: (value) => {
        stdout += value;
      },
      stderr: () => {
        throw new Error("Unexpected metadata search diagnostic");
      }
    });
    return stdout;
  }
  const metadata = renderMetadata("ｍｅｔａ字段 metadata-tag", "all");
  assert.match(metadata, new RegExp(decisionId));
  assert.match(metadata, /matchedFields: title, tags/);
  assert.match(metadata, /matchedRelations:\n    - none/);
  assert.doesNotMatch(metadata, /previews:/);

  const phraseAcrossFields = renderMetadata("字段 metadata-tag", "phrase");
  assert.match(phraseAcrossFields, /- none/);

  const relation = renderMetadata("仅来源关联摘要", "phrase");
  assert.match(relation, new RegExp(decisionId));
  assert.doesNotMatch(
    relation,
    new RegExp("- archived [^\\n]* " + archivedDecisionId)
  );
  assert.match(relation, /matchedFields: $/m);
  assert.match(relation, /- 修订 260710-use-source-cli: 仅来源关联摘要/);

  const typeOnly = renderMetadata("修订", "all");
  assert.match(typeOnly, /- none/);
});

test("decision metadata search uses only its published index and reports index recovery", () =>
  withFixtureWorkspace("query-search-metadata-index", async (workspaceRoot) => {
    const sourcePath = decisionFilePath(workspaceRoot, currentSourcePath);
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile");
    assert.ok(descriptor);
    const readFile = fs.readFile.bind(fs);
    Object.defineProperty(fs, "readFile", {
      ...descriptor,
      value: async (file: string, encoding: BufferEncoding) => {
        if (path.resolve(file) === sourcePath) {
          throw new Error("metadata search must not read Decision Markdown");
        }
        return await readFile(file, encoding);
      }
    });
    try {
      const searched = await runSourceCli([
        "search",
        "生成 CLI",
        "--in",
        "metadata",
        "--root",
        workspaceRoot
      ]);
      assert.equal(searched.exitCode, 0, searched.stderr);
      assert.match(searched.stdout, new RegExp(currentDecisionId));
    } finally {
      Object.defineProperty(fs, "readFile", descriptor);
    }

    await fs.rm(
      path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
    );
    const missing = await runSourceCli([
      "search",
      "生成 CLI",
      "--in",
      "metadata",
      "--root",
      workspaceRoot
    ]);
    assert.equal(missing.exitCode, 1);
    assert.match(missing.stderr, /metadata-index-unavailable/);
    assert.match(missing.stderr, /Run check to diagnose[\s\S]*sync-index/);
  }));
