import {
  assert,
  createPendingConflictRepository,
  createRepositoryFixture,
  fs,
  gitTestOptions,
  hasVersionControlCode,
  openVersionControl,
  path,
  runGit,
  test,
  withTempRoot,
  writeFile,
  writeGitBlob
} from "./version-control-test-support.ts";

test(
  "batch workspace reads acquire one fresh representation basis and omit missing files",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      await writeFile(repositoryRoot, "batch/executable.sh", "execute\n");
      await writeFile(repositoryRoot, "batch/plain.txt", "plain\n");
      runGit(repositoryRoot, ["add", "batch"]);
      runGit(repositoryRoot, [
        "update-index",
        "--chmod=+x",
        "batch/executable.sh"
      ]);
      await fs.chmod(path.join(repositoryRoot, "batch/executable.sh"), 0o755);
      const repository = await openVersionControl(repositoryRoot);
      const priorTrace = process.env.GIT_TRACE2_EVENT;
      try {
        for (const policy of ["true", "false"]) {
          runGit(repositoryRoot, ["config", "core.fileMode", policy]);
          const tracePath = path.join(tempRoot, `batch-${policy}.jsonl`);
          process.env.GIT_TRACE2_EVENT = tracePath;
          const files = await repository.readWorkspaceFiles([
            "batch/plain.txt",
            "batch/executable.sh",
            "batch/missing",
            "batch/plain.txt"
          ]);
          assert.deepEqual(
            files.map((file) => ({
              path: file.path,
              kind: file.kind,
              text: Buffer.from(file.data).toString("utf8")
            })),
            [
              {
                path: "batch/executable.sh",
                kind: "executable",
                text: "execute\n"
              },
              { path: "batch/plain.txt", kind: "regular", text: "plain\n" }
            ]
          );
          const starts = (await fs.readFile(tracePath, "utf8"))
            .split("\n")
            .filter((line) => line.includes('"event":"start"'));
          assert.equal(
            starts.filter((line) => line.includes('"config"')).length,
            1
          );
          assert.equal(
            starts.filter((line) => line.includes('"ls-files"')).length,
            policy === "false" ? 1 : 0
          );
          process.env.GIT_TRACE2_EVENT = priorTrace;
        }
        const emptyTrace = path.join(tempRoot, "batch-empty.jsonl");
        process.env.GIT_TRACE2_EVENT = emptyTrace;
        assert.deepEqual(await repository.readWorkspaceFiles([]), []);
        assert.deepEqual(await repository.readWorkspaceFiles(["absent"]), []);
        await assert.rejects(fs.access(emptyTrace));
      } finally {
        if (priorTrace === undefined) delete process.env.GIT_TRACE2_EVENT;
        else process.env.GIT_TRACE2_EVENT = priorTrace;
      }
    });
  }
);

test(
  "batch workspace reads reject invalid paths types policies and pending representations without writes",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      const repository = await openVersionControl(repositoryRoot);
      await writeFile(repositoryRoot, "regular.txt", "regular\n");
      await assert.rejects(
        repository.readWorkspaceFiles(["regular.txt", "../outside"]),
        (error: unknown) => hasVersionControlCode(error, "invalid-path")
      );
      await fs.symlink("regular.txt", path.join(repositoryRoot, "link.txt"));
      await assert.rejects(
        repository.readWorkspaceFiles(["regular.txt", "link.txt"]),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
      await assert.rejects(
        repository.readWorkspaceFiles(["docs"]),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
      runGit(repositoryRoot, ["config", "core.fileMode", "invalid"]);
      await assert.rejects(
        repository.readWorkspaceFiles(["regular.txt"]),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
      runGit(repositoryRoot, ["config", "core.fileMode", "false"]);
      const linkBlob = writeGitBlob(repositoryRoot, "target");
      runGit(repositoryRoot, [
        "update-index",
        "--add",
        "--cacheinfo",
        `120000,${linkBlob},regular.txt`
      ]);
      await assert.rejects(
        repository.readWorkspaceFiles(["regular.txt"]),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
      const conflictRoot = await createPendingConflictRepository(
        tempRoot,
        "batch-conflict"
      );
      runGit(conflictRoot, ["config", "core.fileMode", "false"]);
      await assert.rejects(
        (await openVersionControl(conflictRoot)).readWorkspaceFiles([
          "conflicted.txt"
        ]),
        (error: unknown) => hasVersionControlCode(error, "operation-failed")
      );
      assert.equal(
        await fs.readFile(path.join(repositoryRoot, "regular.txt"), "utf8"),
        "regular\n"
      );
    });
  }
);

test(
  "batch workspace reads can consume an explicit phase pending basis without weakening default freshness",
  gitTestOptions,
  async () => {
    await withTempRoot(async (tempRoot) => {
      const { repositoryRoot } = await createRepositoryFixture(tempRoot);
      await writeFile(repositoryRoot, "basis.txt", "basis\n");
      runGit(repositoryRoot, ["add", "basis.txt"]);
      runGit(repositoryRoot, ["config", "core.fileMode", "false"]);
      const repository = await openVersionControl(repositoryRoot);
      const pendingFiles = await repository.readPendingFiles({
        pathScopes: ["basis.txt"]
      });
      const priorTrace = process.env.GIT_TRACE2_EVENT;
      const tracePath = path.join(tempRoot, "basis.jsonl");
      try {
        process.env.GIT_TRACE2_EVENT = tracePath;
        const files = await repository.readWorkspaceFiles(["basis.txt"], {
          pendingFiles
        });
        assert.equal(files[0].kind, "regular");
        const starts = (await fs.readFile(tracePath, "utf8"))
          .split("\n")
          .filter((line) => line.includes('"event":"start"'));
        assert.equal(
          starts.filter((line) => line.includes('"config"')).length,
          1
        );
        assert.equal(
          starts.filter((line) => line.includes('"ls-files"')).length,
          0
        );
      } finally {
        if (priorTrace === undefined) delete process.env.GIT_TRACE2_EVENT;
        else process.env.GIT_TRACE2_EVENT = priorTrace;
      }
      runGit(repositoryRoot, ["update-index", "--chmod=+x", "basis.txt"]);
      assert.equal(
        (await repository.readWorkspaceFiles(["basis.txt"]))[0].kind,
        "executable"
      );
      assert.equal(
        (
          await repository.readWorkspaceFiles(["basis.txt"], { pendingFiles })
        )[0].kind,
        "regular"
      );
      assert.equal(
        (
          await repository.readWorkspaceFiles(["basis.txt"], {
            pendingFiles: []
          })
        )[0].kind,
        "regular"
      );
      await assert.rejects(
        repository.readWorkspaceFiles(["basis.txt"], {
          pendingFiles: [...pendingFiles, ...pendingFiles]
        })
      );
      await assert.rejects(
        repository.readWorkspaceFiles(["basis.txt"], {
          pendingFiles: [{ ...pendingFiles[0], kind: "symlink" }]
        })
      );
      assert.equal(
        (await repository.readPendingFiles({ pathScopes: ["basis.txt"] }))[0]
          .kind,
        "executable"
      );
    });
  }
);
