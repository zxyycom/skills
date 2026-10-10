import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { openVersionControl } from "../../shared/src/version-control/index.ts";
import {
  listInvestigationCandidates,
  showInvestigationCandidate
} from "../src/candidate.ts";
import { loadInvestigationIndex } from "../src/investigation-state-index.ts";
import {
  queryInvestigationIndex,
  searchInvestigationReports,
  showInvestigationReport,
  traceInvestigationReports
} from "../src/query.ts";
import {
  collectDomainWrites,
  verifyDomainWrites
} from "../src/staging-domain-writes.ts";
import { stageInvestigationReports } from "../src/staging.ts";
import { validateInvestigationReports } from "../src/validation.ts";
import {
  git,
  initializeGit,
  investigationRoot,
  reportMarkdown,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

async function observeSourceReads<T>(
  root: string,
  run: () => Promise<T>
): Promise<{ result: T; paths: string[] }> {
  const original = fs.readFile;
  const paths: string[] = [];
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const target = typeof args[0] === "string" ? args[0] : "";
    if (
      target.startsWith(investigationRoot(root) + path.sep) &&
      (target.endsWith(".md") ||
        path.basename(target).startsWith("_candidate."))
    )
      paths.push(target);
    return await original(...args);
  }) as typeof fs.readFile;
  try {
    return { result: await run(), paths };
  } finally {
    fs.readFile = original;
  }
}

test("published investigation queries read no formal or candidate Markdown even when sources disappear", async () => {
  await withTempRoot("snapshot-acquisition", async (root) => {
    await writeCollection(root, [{ id: "one" }, { id: "two" }]);
    await fs.rm(path.join(investigationRoot(root), "one.md"));
    await fs.writeFile(
      path.join(investigationRoot(root), "_candidate.other"),
      "invalid source\n"
    );
    const observed = await observeSourceReads(root, async () => ({
      list: await queryInvestigationIndex({ workspaceRoot: root, limit: 1 }),
      trace: await traceInvestigationReports({
        workspaceRoot: root,
        id: "one"
      }),
      search: await searchInvestigationReports({
        workspaceRoot: root,
        query: "当前",
        in: "metadata",
        limit: 1
      })
    }));
    assert.deepEqual(observed.paths, []);
    assert.deepEqual(observed.result.list.errors, []);
    assert.equal(observed.result.trace.status, "ok");
    assert.equal(observed.result.search.status, "ok");
    assert.deepEqual(observed.result.list.warnings, []);
    assert.deepEqual(observed.result.trace.warnings, []);
    assert.deepEqual(observed.result.search.warnings, [
      "search results limited: max-records"
    ]);
  });
});

test("investigation show and indexed scoped check read only their selected ordinary source", async () => {
  await withTempRoot("local-acquisition", async (root) => {
    await writeCollection(root, [
      { id: "one", sourcePath: "semantic.md" },
      { id: "two" }
    ]);
    await fs.writeFile(
      path.join(investigationRoot(root), "two.md"),
      "unrelated malformed source"
    );
    const shown = await observeSourceReads(root, () =>
      showInvestigationReport({ workspaceRoot: root, id: "one" })
    );
    assert.equal(shown.result.status, "ok");
    assert.deepEqual(shown.paths, [
      path.join(investigationRoot(root), "semantic.md")
    ]);
    const checked = await observeSourceReads(root, () =>
      validateInvestigationReports({ workspaceRoot: root, ids: ["one"] })
    );
    assert.deepEqual(checked.result.errors, []);
    assert.equal(checked.result.indexChecked, false);
    assert.deepEqual(checked.paths, shown.paths);
    const target = path.join(investigationRoot(root), "semantic.md");
    await fs.rm(target);
    await fs.writeFile(
      path.join(root, "outside.md"),
      reportMarkdown({ id: "one" })
    );
    await fs.symlink(path.join(root, "outside.md"), target);
    assert.equal(
      (await showInvestigationReport({ workspaceRoot: root, id: "one" }))
        .status,
      "error"
    );
    assert.ok(
      (
        await validateInvestigationReports({
          workspaceRoot: root,
          ids: ["one"]
        })
      ).errors.length > 0
    );
  });
});

test("scoped investigation discovery resolves moved and unpublished formal identities without global proof", async () => {
  await withTempRoot("local-discovery", async (root) => {
    await writeCollection(root, [{ id: "one" }]);
    await fs.rename(
      path.join(investigationRoot(root), "one.md"),
      path.join(investigationRoot(root), "moved.md")
    );
    await fs.writeFile(
      path.join(investigationRoot(root), "new.md"),
      reportMarkdown({ id: "new" })
    );
    await fs.writeFile(
      path.join(investigationRoot(root), "unrelated.md"),
      "malformed\n"
    );
    const checked = await validateInvestigationReports({
      workspaceRoot: root,
      ids: ["one", "new"]
    });
    assert.deepEqual(checked.errors, []);
    assert.equal(checked.selectedReportCount, 2);
    assert.equal(checked.indexChecked, false);
    assert.ok(
      (await validateInvestigationReports({ workspaceRoot: root })).errors
        .length > 0
    );
  });
});

test("candidate listing shares one identity snapshot and candidate show reads only required formal owners", async () => {
  await withTempRoot("candidate-acquisition", async (root) => {
    const directory = investigationRoot(root);
    await fs.mkdir(path.join(directory, "_resources", "formal"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(directory, "_resources", "formal", "sample.txt"),
      "shared sample\n"
    );
    await writeCollection(root, [
      { id: "formal", resources: ["formal/sample.txt"] },
      { id: "unused" }
    ]);
    for (let index = 0; index < 8; index += 1)
      await fs.writeFile(
        path.join(directory, `_candidate.item-${index}`),
        reportMarkdown({
          id: `item-${index}`,
          ...(index === 0 ? { resources: ["formal/sample.txt"] } : {})
        })
      );
    const listed = await observeSourceReads(root, () =>
      listInvestigationCandidates({ workspaceRoot: root })
    );
    assert.equal(listed.result.status, "ok");
    assert.equal(listed.result.candidates.length, 8);
    const candidateReads = listed.paths.filter((file) =>
      path.basename(file).startsWith("_candidate.")
    );
    assert.equal(candidateReads.length, 8);
    assert.equal(new Set(candidateReads).size, 8);
    const shown = await observeSourceReads(root, () =>
      showInvestigationCandidate({ workspaceRoot: root, id: "item-0" })
    );
    assert.equal(shown.result.status, "ok");
    assert.deepEqual(
      shown.paths.filter((file) => file.endsWith(".md")),
      [path.join(directory, "formal.md")]
    );
    assert.equal(
      shown.paths.filter((file) =>
        path.basename(file).startsWith("_candidate.")
      ).length,
      8
    );
    assert.equal(shown.result.candidate?.readiness.resourceReady, true);
  });
});

test("investigation domain preparation batches selected member and source reads but rereads before writing", async () => {
  await withTempRoot("domain-acquisition", async (root) => {
    await writeCollection(root, [{ id: "one" }, { id: "two" }]);
    initializeGit(root);
    const repository = await openVersionControl(root);
    const loaded = await loadInvestigationIndex({
      investigationsDirectory: investigationRoot(root)
    });
    assert.equal(loaded.status, "ok");
    if (loaded.status !== "ok") return;
    const calls = { workspace: 0, head: 0, sources: 0 };
    const originalWorkspace = repository.listWorkspaceFiles;
    const originalHead = repository.listRevisionFiles;
    const originalSources = repository.readWorkspaceFiles;
    repository.listWorkspaceFiles = async (options) => {
      calls.workspace += 1;
      return await originalWorkspace.call(repository, options);
    };
    repository.listRevisionFiles = async (revision, options) => {
      calls.head += 1;
      return await originalHead.call(repository, revision, options);
    };
    repository.readWorkspaceFiles = async (paths) => {
      calls.sources += 1;
      return await originalSources.call(repository, paths);
    };
    const options = {
      repository,
      baseline: loaded.value,
      workspaceIndex: loaded.value,
      revision: await repository.getCurrentRevision(),
      selectedIds: ["one", "two"],
      investigationsScope: "docs/investigations"
    };
    const prepared = await collectDomainWrites(options);
    assert.equal(prepared.status, "ok");
    assert.deepEqual(calls, { workspace: 1, head: 1, sources: 1 });
    if (prepared.status !== "ok") return;
    assert.equal(
      await verifyDomainWrites({ ...options, writes: prepared.value }),
      null
    );
    assert.deepEqual(calls, { workspace: 2, head: 2, sources: 2 });
    await fs.mkdir(path.join(investigationRoot(root), "_resources", "one"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(investigationRoot(root), "_resources", "one", "new.txt"),
      "new member\n"
    );
    assert.match(
      (await verifyDomainWrites({ ...options, writes: prepared.value }))!,
      /members changed/u
    );
    await fs.appendFile(
      path.join(investigationRoot(root), "one.md"),
      "changed source\n"
    );
    assert.equal((await collectDomainWrites(options)).status, "error");
    await fs.writeFile(
      path.join(investigationRoot(root), "one.md"),
      new Uint8Array([0xff])
    );
    assert.equal((await collectDomainWrites(options)).status, "error");
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
  });
});

test("investigation stage rejects invalid formal resource ownership before pending writes", async () => {
  await withTempRoot("stage-ownership", async (root) => {
    await fs.mkdir(path.join(investigationRoot(root), "_resources", "owner"), {
      recursive: true
    });
    await fs.writeFile(
      path.join(investigationRoot(root), "_resources", "owner", "sample.txt"),
      "sample\n"
    );
    await writeCollection(root, [
      { id: "owner", resources: ["owner/sample.txt"] },
      { id: "shared", resources: ["owner/sample.txt"] }
    ]);
    initializeGit(root);
    await fs.writeFile(
      path.join(investigationRoot(root), "owner.md"),
      reportMarkdown({ id: "owner" })
    );
    // A manually forged fresh projection is not a proof of resource ownership.
    const { readInvestigationStateSnapshot } =
      await import("../src/investigation-index-source.ts");
    const { syncInvestigationStateIndex } =
      await import("../src/investigation-state-index.ts");
    await syncInvestigationStateIndex({
      investigationsDirectory: investigationRoot(root),
      mode: "write",
      snapshot: await readInvestigationStateSnapshot(investigationRoot(root))
    });
    const staged = await stageInvestigationReports({
      workspaceRoot: root,
      reportIds: ["shared"],
      scope: "domain"
    });
    assert.equal(staged.status, "error");
    assert.match(
      staged.diagnostics.map((diagnostic) => diagnostic.message).join("\n"),
      /must be referenced by its owner/u
    );
    assert.equal(git(root, ["diff", "--cached", "--name-only"]), "");
  });
});

test("investigation predecessor diagnostics skip Git without targets and never read all HEAD files for an empty report scope", async () => {
  await withTempRoot("history-acquisition", async (root) => {
    await fs.writeFile(path.join(root, "notes.txt"), "unrelated HEAD data\n");
    initializeGit(root);
    await writeCollection(root, [
      { id: "base" },
      { id: "next", relations: [{ type: "补充", target: "base" }] }
    ]);
    const loaded = await loadInvestigationIndex({
      investigationsDirectory: investigationRoot(root)
    });
    assert.equal(loaded.status, "ok");
    if (loaded.status !== "ok") return;
    const { unrecordedPredecessorWarnings } =
      await import("../src/validation-history.ts");
    const previous = process.env.GIT_TRACE2_EVENT;
    const trace = path.join(root, "history.jsonl");
    try {
      process.env.GIT_TRACE2_EVENT = trace;
      assert.deepEqual(
        await unrecordedPredecessorWarnings(
          investigationRoot(root),
          new Map([["base", loaded.value.entries["base"]!]])
        ),
        []
      );
      await assert.rejects(fs.access(trace));
      const warnings = await unrecordedPredecessorWarnings(
        investigationRoot(root),
        new Map(Object.entries(loaded.value.entries))
      );
      assert.equal(warnings.length, 1);
      assert.match(warnings[0]!, /前序报告 base 尚未进入 Git HEAD/u);
      const starts = (await fs.readFile(trace, "utf8"))
        .split("\n")
        .filter((line) => line.includes('"event":"start"'));
      assert.equal(
        starts.filter((line) => line.includes('"cat-file"')).length,
        0
      );
    } finally {
      if (previous === undefined) delete process.env.GIT_TRACE2_EVENT;
      else process.env.GIT_TRACE2_EVENT = previous;
    }
  });
});
