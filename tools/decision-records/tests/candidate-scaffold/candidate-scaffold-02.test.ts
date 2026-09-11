import {
  assert,
  candidateDecisionBody,
  candidateId,
  decisionFilePath,
  fileExists,
  fs,
  newCandidateArguments,
  path,
  runSourceCli,
  test,
  withTemporaryWorkspace,
  writeDecision
} from "./support.ts";

test("lifecycle preflight is read-only and still requires a body-ready candidate", () =>
  withTemporaryWorkspace(
    "candidate-lifecycle-preflight",
    async (workspaceRoot) => {
      const scaffold = await runSourceCli([
        ...newCandidateArguments,
        "--preflight-alignment",
        "aligned",
        "--root",
        workspaceRoot
      ]);
      assert.equal(scaffold.exitCode, 0, scaffold.stderr);
      assert.match(
        scaffold.stderr,
        /alignment preview: aligned \(provided to auxiliary preparation/
      );
      const candidatePath = decisionFilePath(workspaceRoot, candidateId);
      const incompleteText = await fs.readFile(candidatePath, "utf8");
      const incompletePreflight = await runSourceCli([
        "activate",
        candidateId,
        "--alignment",
        "unaligned",
        "--preflight",
        "--root",
        workspaceRoot
      ]);
      assert.equal(incompletePreflight.exitCode, 1);
      assert.match(incompletePreflight.stderr, /candidate is unavailable/);
      assert.equal(await fs.readFile(candidatePath, "utf8"), incompleteText);

      await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
      const readyText = await fs.readFile(candidatePath, "utf8");
      const preflight = await runSourceCli([
        "activate",
        candidateId,
        "--alignment",
        "unaligned",
        "--preflight",
        "--root",
        workspaceRoot
      ]);
      assert.equal(preflight.exitCode, 0, preflight.stderr);
      assert.match(preflight.stdout, /Decision lifecycle preflight passed/);
      assert.match(
        preflight.stdout,
        /No Decision Markdown, derived index, or pending state was changed/
      );
      assert.equal(await fs.readFile(candidatePath, "utf8"), readyText);
      assert.equal(
        await fileExists(
          path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
        ),
        false
      );

      const activated = await runSourceCli([
        "activate",
        candidateId,
        "--alignment",
        "unaligned",
        "--root",
        workspaceRoot
      ]);
      assert.equal(activated.exitCode, 0, activated.stderr);
      assert.equal(
        await fileExists(
          path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
        ),
        true
      );
    }
  ));

test("formal lifecycle re-reads candidate readiness after acquiring the collection lock", () =>
  withTemporaryWorkspace(
    "locked-candidate-readiness",
    async (workspaceRoot) => {
      const candidatePath = decisionFilePath(workspaceRoot, candidateId);
      await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
      const descriptor = Object.getOwnPropertyDescriptor(fs, "open");
      assert.ok(descriptor);
      const open = fs.open.bind(fs);
      let changedAfterLock = false;
      Object.defineProperty(fs, "open", {
        ...descriptor,
        value: async (...args: Parameters<typeof fs.open>) => {
          const handle = await open(...args);
          if (
            String(args[0]).endsWith(".decision-index.json.mutation.lock") &&
            !changedAfterLock
          ) {
            changedAfterLock = true;
            const current = await fs.readFile(candidatePath, "utf8");
            await fs.writeFile(
              candidatePath,
              current.replace(
                "## 目的\n- 验证 Markdown 生命周期独立定义候选和已建立状态。",
                "## 目的"
              ),
              "utf8"
            );
          }
          return handle;
        }
      });
      let activated: Awaited<ReturnType<typeof runSourceCli>>;
      try {
        activated = await runSourceCli([
          "activate",
          candidateId,
          "--alignment",
          "unaligned",
          "--root",
          workspaceRoot
        ]);
      } finally {
        Object.defineProperty(fs, "open", descriptor);
      }
      assert.equal(changedAfterLock, true);
      assert.equal(activated!.exitCode, 1);
      assert.match(activated!.stderr, /candidate is unavailable/);
      assert.equal(
        await fileExists(
          path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
        ),
        false
      );
    }
  ));

test("formal lifecycle reports committed cleanup instead of success when lock release fails", () =>
  withTemporaryWorkspace("locked-candidate-release", async (workspaceRoot) => {
    await writeDecision(workspaceRoot, candidateId, candidateDecisionBody());
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
    let activated: Awaited<ReturnType<typeof runSourceCli>>;
    try {
      activated = await runSourceCli([
        "activate",
        candidateId,
        "--alignment",
        "unaligned",
        "--root",
        workspaceRoot
      ]);
    } finally {
      Object.defineProperty(fs, "rm", descriptor);
    }
    assert.equal(releaseBlocked, true);
    assert.equal(activated!.exitCode, 1);
    assert.equal(activated!.stdout, "");
    assert.match(activated!.stderr, /outcome: committed-cleanup-pending/);
    assert.match(
      activated!.stderr,
      /code: decision-records\.collection-lock-release-failed/
    );
    assert.equal(
      await fileExists(
        path.join(workspaceRoot, "docs", "decisions", "decision-index.json")
      ),
      true
    );
    await fs.rm(
      path.join(workspaceRoot, "docs", ".decision-index.json.mutation.lock"),
      { force: true }
    );
  }));
