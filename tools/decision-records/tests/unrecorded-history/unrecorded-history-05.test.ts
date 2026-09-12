import {
  assert,
  candidateDecisionBody,
  decisionFilePath,
  establishUnrecordedIntermediate,
  fs,
  readIndex,
  runSourceCli,
  test,
  withGitFixtureWorkspace
} from "./support.ts";

test("evolve probes group-only predecessors before writing", () =>
  withGitFixtureWorkspace(
    "unrecorded-grouped-predecessor",
    async (workspaceRoot) => {
      const { indexPath, intermediatePath } =
        await establishUnrecordedIntermediate(workspaceRoot);
      const successor = "grouped-unrecorded-successor";
      const successorPath = decisionFilePath(workspaceRoot, successor);
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const successorBefore = await fs.readFile(successorPath, "utf8");
      const predecessorBefore = await fs.readFile(intermediatePath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");

      const paused = await runSourceCli([
        "evolve",
        "--successor",
        "aligned=" + successor,
        "--relations-for",
        successor,
        "--relation",
        "修订=use-unrecorded-intermediate",
        "--root",
        workspaceRoot
      ]);
      assert.equal(paused.exitCode, 1);
      assert.equal(paused.stdout, "");
      assert.match(paused.stderr, /command paused with warnings/);
      assert.match(
        paused.stderr,
        /Predecessor decision use-unrecorded-intermediate has not entered Git HEAD/
      );
      assert.equal(await fs.readFile(successorPath, "utf8"), successorBefore);
      assert.equal(
        await fs.readFile(intermediatePath, "utf8"),
        predecessorBefore
      );
      assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
      assert.equal(
        Object.hasOwn((await readIndex(indexPath)).entries, successor),
        false
      );
    }
  ));
