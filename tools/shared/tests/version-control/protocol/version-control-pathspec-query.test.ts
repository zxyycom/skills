import {
  assert,
  createRepositoryFixture,
  execFileSync,
  fs,
  gitTestOptions,
  gitCommitEnvironment,
  openVersionControl,
  path,
  test,
  withTempRoot
} from "./version-control-test-support.ts";
import { mock } from "node:test";
import { createGitClient } from "../../../src/version-control/git/git-command.ts";
import { readRevisionFilePrefixes } from "../../../src/version-control/revision-file-prefixes.ts";
import {
  gitPathspecBatches,
  queryGitPathspecs
} from "../../../src/version-control/git/git-pathspec-query.ts";
import { gitContextForRepository } from "../../../src/version-control/git/git-repository.ts";
import { listPendingEntries } from "../../../src/version-control/git/pending/git-pending.ts";

function largeScopes(): string[] {
  return [
    "docs",
    ...Array.from(
      { length: 200 },
      (_, index) => `docs/missing-${index}-${"x".repeat(220)}`
    ),
    "docs/tracked.md"
  ];
}

test(
  "Git revision path queries split large literal unions without widening selection",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const trace = path.join(tempRoot, "git-trace.jsonl");
      // docs 与 docs/tracked.md 排序后分属不同批次。
      const scopes = largeScopes();
      const options = { pathScopes: scopes };
      const previousTrace = process.env.GIT_TRACE2_EVENT;
      process.env.GIT_TRACE2_EVENT = trace;
      try {
        assert.deepEqual(
          await repository.listRevisionFiles(currentRevision, options),
          await repository.listRevisionFiles(currentRevision, {
            pathScopes: ["docs"]
          })
        );
        assert.deepEqual(
          await repository.readRevisionFiles(currentRevision, options),
          await repository.readRevisionFiles(currentRevision, {
            pathScopes: ["docs"]
          })
        );
      } finally {
        if (previousTrace === undefined) delete process.env.GIT_TRACE2_EVENT;
        else process.env.GIT_TRACE2_EVENT = previousTrace;
      }
      const starts = (await fs.readFile(trace, "utf8"))
        .split("\n")
        .filter((line) => line.includes('"event":"start"'));
      const queries = starts.filter((line) => line.includes('"ls-tree"'));
      assert.ok(queries.length > 6);
      assert.ok(queries.every((line) => Buffer.byteLength(line) < 28_000));
      assert.deepEqual(
        await readRevisionFilePrefixes(repository, {
          revision: currentRevision,
          paths: scopes,
          prefixBytes: 3
        }),
        await readRevisionFilePrefixes(repository, {
          revision: currentRevision,
          paths: ["docs"],
          prefixBytes: 3
        })
      );
    });
  }
);

test(
  "Git workspace and pending queries preserve unions across pathspec batches",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot, currentRevision } =
        await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const options = { pathScopes: largeScopes() };
      assert.deepEqual(
        await repository.listWorkspaceFiles(options),
        await repository.listWorkspaceFiles({ pathScopes: ["docs"] })
      );
      assert.deepEqual(
        await repository.readPendingFiles(options),
        await repository.readPendingFiles({ pathScopes: ["docs"] })
      );
      assert.deepEqual(
        await repository.listPendingChangedPaths({
          from: currentRevision,
          ...options
        }),
        await repository.listPendingChangedPaths({
          from: currentRevision,
          pathScopes: ["docs"]
        })
      );
    });
  }
);

test(
  "Git path queries retain alternate-index selection across batches",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      const context = gitContextForRepository(repository);
      const index = path.join(tempRoot, "alternate-index");
      await fs.copyFile(path.join(repositoryRoot, ".git/index"), index);
      execFileSync(
        "git",
        [
          "-C",
          repositoryRoot,
          "update-index",
          "--force-remove",
          "docs/tracked.md"
        ],
        {
          env: { ...gitCommitEnvironment, GIT_INDEX_FILE: index }
        }
      );
      const expected = await listPendingEntries(context, ["docs"], index);
      assert.ok(expected.length > 0);
      assert.ok(!expected.some((entry) => entry.path === "docs/tracked.md"));
      assert.deepEqual(
        await listPendingEntries(context, largeScopes(), index),
        expected
      );
      assert.ok(
        (await repository.readPendingFiles()).some(
          (entry) => entry.path === "docs/tracked.md"
        )
      );
    });
  }
);

test(
  "Git path-query merging preserves within-batch duplicate records",
  gitTestOptions,
  async () => {
    const context = {
      rootDirectory: process.cwd(),
      hooks: {},
      git: createGitClient(process.cwd())
    };
    let calls = 0;
    const raw = mock.method(context.git, "raw", async () =>
      ++calls === 1 ? "same\0first\0" : "same\0same\0other\0"
    );
    try {
      const result = await queryGitPathspecs(
        context,
        ["ls-files", "-z", "--"],
        largeScopes()
      );
      assert.ok(calls > 1);
      assert.equal(
        result.split("\0").filter((record) => record === "same").length,
        calls
      );
      assert.equal(
        result.split("\0").filter((record) => record === "other").length,
        1
      );
    } finally {
      raw.mock.restore();
    }
  }
);

test(
  "Git path queries reject later batch failure without partial results",
  gitTestOptions,
  async () => {
    const context = {
      rootDirectory: process.cwd(),
      hooks: {},
      git: createGitClient(process.cwd())
    };
    let calls = 0;
    const raw = mock.method(context.git, "raw", async () => {
      if (++calls === 1) return "first\0";
      throw new Error("later batch failure");
    });
    try {
      await assert.rejects(
        queryGitPathspecs(context, ["ls-files", "-z", "--"], largeScopes()),
        /later batch failure/u
      );
      assert.equal(calls, 2);
    } finally {
      raw.mock.restore();
    }
  }
);

test("Git pathspec planning keeps small and unscoped queries in one batch", () => {
  assert.deepEqual(gitPathspecBatches("/repo", ["ls-files", "-z", "--"], []), [
    []
  ]);
  assert.deepEqual(
    gitPathspecBatches(
      "/repo",
      ["ls-files", "-z", "--"],
      ["docs/a b.md", "docs/字😀.md"]
    ),
    [[":(literal)docs/a b.md", ":(literal)docs/字😀.md"]]
  );
});

test("Git pathspec planning budgets UTF8 and Windows escaping with fixed arguments", () => {
  const scopes = Array.from(
    { length: 150 },
    (_, index) => `docs/${index}-${'字😀"'.repeat(30)}.md`
  );
  const fixed = ["ls-tree", "-r", "-z", "a".repeat(40), "--"];
  const batches = gitPathspecBatches("/repo with spaces", fixed, scopes);
  assert.ok(batches.length > 1);
  assert.deepEqual(
    batches.flat(),
    scopes.map((scope) => `:(literal)${scope}`)
  );
  for (const batch of batches) {
    const args = ["git", "-C", "/repo with spaces", ...fixed, ...batch];
    assert.ok(
      args.reduce((total, arg) => total + 2 * arg.length + 3, 1) <= 28_000
    );
    assert.ok(
      args.reduce((total, arg) => total + Buffer.byteLength(arg) + 9, 1) <=
        28_000
    );
  }
});

test("Git pathspec planning rejects oversized fixed arguments", () => {
  assert.throws(
    () => gitPathspecBatches("/repo", ["x".repeat(28_000)], []),
    /fixed arguments exceed/u
  );
});

test("Git pathspec planning rejects an indivisible oversized scope", () => {
  assert.throws(
    () =>
      gitPathspecBatches(
        "/repo",
        ["ls-files", "-z", "--"],
        ["x".repeat(28_000)]
      ),
    /one path scope exceeds/u
  );
});
