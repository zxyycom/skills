import {
  assert,
  candidateId,
  decisionFilePath,
  fileExists,
  fs,
  newCandidateArguments,
  path,
  runSourceCli,
  test,
  withTemporaryWorkspace
} from "./support.ts";

test("new creates a canonical incomplete scaffold without entering the established collection", () =>
  withTemporaryWorkspace("new-candidate-scaffold", async (workspaceRoot) => {
    const created = await runSourceCli([
      ...newCandidateArguments,
      "--root",
      workspaceRoot
    ]);
    assert.equal(created.exitCode, 0, created.stderr);
    assert.match(created.stdout, new RegExp(candidateId));
    assert.match(
      created.stdout,
      /No lifecycle state or derived decision index was changed/
    );
    assert.match(created.stderr, /scaffoldValid: true/);
    assert.match(created.stderr, /bodyReady: false/);
    assert.match(created.stderr, /preflight: selection-incomplete/);
    assert.match(created.stderr, /do not rerun new/i);
    assert.doesNotMatch(created.stderr, /outcome:/);

    const candidatePath = decisionFilePath(workspaceRoot, candidateId);
    const scaffold = await fs.readFile(candidatePath, "utf8");
    assert.match(scaffold, /status: candidate/);
    assert.match(scaffold, /alignment: null/);
    assert.match(scaffold, /createdAt: null/);
    assert.match(scaffold, /tags:\n  - decision-records\n  - zeta/);
    assert.match(scaffold, /## 目的\n\n## 背景\n\n## 决策\n$/);
    assert.deepEqual(
      (await fs.readdir(path.dirname(candidatePath))).filter((entry) =>
        entry.startsWith(".decision-records-candidate-")
      ),
      []
    );
    assert.equal(
      await fileExists(
        path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
      ),
      false
    );

    const candidates = await runSourceCli([
      "candidates",
      "--root",
      workspaceRoot
    ]);
    assert.equal(candidates.exitCode, 0, candidates.stderr);
    assert.match(candidates.stdout, new RegExp(candidateId));
    assert.match(candidates.stdout, /scaffoldValid: true/);
    assert.match(candidates.stdout, /bodyReady: false/);

    const checked = await runSourceCli(["check", "--root", workspaceRoot]);
    assert.equal(checked.exitCode, 0, checked.stderr);
    assert.match(
      checked.stdout,
      /1 candidate scaffolds, 0 body-ready candidates/
    );

    const duplicate = await runSourceCli([
      ...newCandidateArguments,
      "--root",
      workspaceRoot
    ]);
    assert.equal(duplicate.exitCode, 1);
    assert.match(duplicate.stderr, /already exists in the current collection/);
    assert.equal(await fs.readFile(candidatePath, "utf8"), scaffold);

    const lockPath = path.join(
      workspaceRoot,
      "docs",
      ".decision-index.json.mutation.lock"
    );
    await fs.writeFile(lockPath, "active transaction\n", "utf8");
    try {
      const locked = await runSourceCli([
        "new",
        "blocked-candidate.md",
        "--title",
        "锁定候选创建",
        "--purpose",
        "验证锁冲突不会写入候选。",
        "--background",
        "集合写入必须串行完成。",
        "--decision",
        "拒绝锁冲突中的创建。",
        "--tag",
        "decision-records",
        "--root",
        workspaceRoot
      ]);
      assert.equal(locked.exitCode, 1);
      assert.match(locked.stderr, /collection lock/i);
      assert.equal(
        await fileExists(
          decisionFilePath(workspaceRoot, "blocked-candidate.md")
        ),
        false
      );
    } finally {
      await fs.rm(lockPath, { force: true });
    }

    await fs.writeFile(
      decisionFilePath(workspaceRoot, "invalid-existing-source.md"),
      "not Decision Markdown\n",
      "utf8"
    );
    const invalidCollection = await runSourceCli([
      "new",
      "blocked-by-invalid-source.md",
      "--title",
      "无效来源阻断创建",
      "--purpose",
      "已有无效 Markdown 不能被新脚手架掩盖。",
      "--background",
      "创建前必须读取当前候选集合。",
      "--decision",
      "拒绝无效集合中的新增身份。",
      "--tag",
      "decision-records",
      "--root",
      workspaceRoot
    ]);
    assert.equal(invalidCollection.exitCode, 1);
    assert.match(invalidCollection.stderr, /collection problem/);
    assert.equal(
      await fileExists(
        decisionFilePath(workspaceRoot, "blocked-by-invalid-source.md")
      ),
      false
    );
    await fs.rm(decisionFilePath(workspaceRoot, "invalid-existing-source.md"));

    const invalid = await runSourceCli([
      "new",
      "invalid/candidate.md",
      "--title",
      "非法候选身份",
      "--purpose",
      "验证非法输入没有任何写入。",
      "--background",
      "路径不能作为稳定的决策身份。",
      "--decision",
      "拒绝不规范的候选标识。",
      "--tag",
      "decision-records",
      "--root",
      workspaceRoot
    ]);
    assert.equal(invalid.exitCode, 2);
    assert.equal(
      await fileExists(
        path.join(workspaceRoot, "docs", "decisions", "invalid", "candidate.md")
      ),
      false
    );
  }));

test("new preserves its created scaffold when collection lock cleanup fails", () =>
  withTemporaryWorkspace(
    "new-candidate-lock-release",
    async (workspaceRoot) => {
      const descriptor = Object.getOwnPropertyDescriptor(fs, "rm");
      assert.ok(descriptor);
      const remove = fs.rm.bind(fs);
      let releaseBlocked = false;
      Object.defineProperty(fs, "rm", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.rm>) => {
          if (
            String(args[0]).endsWith(".decision-index.json.mutation.lock") &&
            !releaseBlocked
          ) {
            releaseBlocked = true;
            throw Object.assign(new Error("simulated lock release failure"), {
              code: "EACCES"
            });
          }
          return await remove(...args);
        }
      });
      let created: Awaited<ReturnType<typeof runSourceCli>>;
      try {
        created = await runSourceCli([
          ...newCandidateArguments,
          "--root",
          workspaceRoot
        ]);
      } finally {
        Object.defineProperty(fs, "rm", descriptor);
      }
      assert.equal(releaseBlocked, true);
      assert.equal(created!.exitCode, 1);
      assert.match(created!.stdout, /Created decision candidate scaffold/);
      assert.match(
        created!.stderr,
        /code: decision-records\.collection-lock-release-failed/
      );
      assert.match(created!.stderr, /outcome: committed-cleanup-pending/);
      assert.equal(
        await fileExists(decisionFilePath(workspaceRoot, candidateId)),
        true
      );
      await fs.rm(
        path.join(workspaceRoot, "docs", ".decision-index.json.mutation.lock"),
        { force: true }
      );
    }
  ));
