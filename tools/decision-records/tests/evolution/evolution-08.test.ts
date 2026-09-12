import { spawnSync } from "node:child_process";
import {
  assert,
  candidateDecisionBody,
  decisionFilePath,
  establishClosedSplit,
  findIndexEntry,
  fs,
  generatedCliPath,
  readIndex,
  runSourceLifecycleCli,
  runSuccessfulSourceLifecycleCli,
  test,
  withFixtureWorkspace
} from "./support.ts";

test("evolve applies one grouped replacement while preserving ungrouped successors", () =>
  withFixtureWorkspace(
    "evolve-grouped-candidate-established",
    async (workspaceRoot) => {
      const established = await establishClosedSplit(workspaceRoot);
      const candidate = "260901-grouped-candidate-split-slice";
      await fs.writeFile(
        decisionFilePath(workspaceRoot, candidate),
        candidateDecisionBody(),
        "utf8"
      );
      const output = await runSuccessfulSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + established.alignedRelativePath,
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--successor",
        "aligned=" + candidate,
        "--relations-for",
        "grouped-candidate-split-slice",
        "--relation-summary",
        established.coarseRelativePath + "=候选先绑定摘要",
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.match(
        output,
        new RegExp("- " + candidate + " action=establish", "u")
      );
      for (const establishedSuccessor of [
        established.alignedRelativePath,
        established.unalignedRelativePath
      ])
        assert.match(
          output,
          new RegExp("- " + establishedSuccessor + " action=unchanged", "u")
        );
      const index = await readIndex(established.indexPath);
      assert.deepEqual(findIndexEntry(index, candidate).relations, [
        {
          summary: "候选先绑定摘要",
          target: established.coarseRelativePath,
          type: "拆分"
        }
      ]);
      assert.deepEqual(
        findIndexEntry(index, established.alignedRelativePath).relations,
        [{ target: established.coarseRelativePath, type: "拆分" }]
      );
      assert.deepEqual(
        findIndexEntry(index, established.unalignedRelativePath).relations,
        [{ target: established.coarseRelativePath, type: "拆分" }]
      );
    }
  ));

test("evolve rejects invalid grouped sources and summaries without writing", () =>
  withFixtureWorkspace(
    "evolve-grouped-selection-errors",
    async (workspaceRoot) => {
      const successor = "grouped-selection-successor";
      const successorPath = decisionFilePath(workspaceRoot, successor);
      await fs.writeFile(successorPath, candidateDecisionBody(), "utf8");
      const indexPath = `${workspaceRoot}/docs/decisions/decision-index.json`;
      const candidateBefore = await fs.readFile(successorPath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      for (const { args, diagnostic } of [
        {
          args: [
            "--relations-for",
            "use-generated-cli",
            "--relation",
            "修订=use-generated-cli"
          ],
          diagnostic: /not a selected successor/u
        },
        {
          args: [
            "--relations-for",
            successor,
            "--relation",
            "修订=use-generated-cli",
            "--relation-summary",
            "260710-use-source-cli=未命中摘要"
          ],
          diagnostic:
            /relation-summary target is not in the complete relation set/u
        },
        {
          args: [
            "--relations-for",
            successor,
            "--relation",
            "修订=260710-use-source-cli",
            "--relation",
            "替代=use-source-cli"
          ],
          diagnostic: /resolve to the same direct predecessor target/u
        }
      ]) {
        const result = await runSourceLifecycleCli([
          "evolve",
          "--successor",
          "aligned=" + successor,
          ...args,
          "--root",
          workspaceRoot
        ]);
        assert.equal(result.exitCode, 1);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, diagnostic);
        assert.equal(await fs.readFile(successorPath, "utf8"), candidateBefore);
        assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
      }
      const datedSuccessor = "260901-grouped-duplicate-source";
      const datedPath = decisionFilePath(workspaceRoot, datedSuccessor);
      await fs.writeFile(
        datedPath,
        candidateDecisionBody({ id: datedSuccessor }),
        "utf8"
      );
      const datedBefore = await fs.readFile(datedPath, "utf8");
      const duplicateSource = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + datedSuccessor,
        "--relations-for",
        datedSuccessor,
        "--relation",
        "修订=use-generated-cli",
        "--relations-for",
        "grouped-duplicate-source",
        "--relation",
        "修订=use-generated-cli",
        "--root",
        workspaceRoot
      ]);
      assert.equal(duplicateSource.exitCode, 1);
      assert.equal(duplicateSource.stdout, "");
      assert.match(
        duplicateSource.stderr,
        /resolves to the same selected successor more than once/u
      );
      assert.equal(await fs.readFile(datedPath, "utf8"), datedBefore);
    }
  ));

test("evolve rejects incomplete, mismatched, and impure grouped replacements without writing", () =>
  withFixtureWorkspace(
    "evolve-grouped-complete-replacement-errors",
    async (workspaceRoot) => {
      const firstSuccessor = "grouped-complete-first";
      const secondSuccessor = "grouped-complete-second";
      const firstPath = decisionFilePath(workspaceRoot, firstSuccessor);
      const secondPath = decisionFilePath(workspaceRoot, secondSuccessor);
      const indexPath = `${workspaceRoot}/docs/decisions/decision-index.json`;
      await fs.writeFile(
        firstPath,
        candidateDecisionBody({
          id: firstSuccessor,
          relations: [{ target: "use-generated-cli", type: "修订" }]
        }),
        "utf8"
      );
      await fs.writeFile(
        secondPath,
        candidateDecisionBody({
          id: secondSuccessor,
          relations: [{ target: "260710-use-source-cli", type: "修订" }]
        }),
        "utf8"
      );
      const firstBefore = await fs.readFile(firstPath, "utf8");
      const secondBefore = await fs.readFile(secondPath, "utf8");
      const indexBefore = await fs.readFile(indexPath, "utf8");
      const selected = [
        "--successor",
        "aligned=" + firstSuccessor,
        "--successor",
        "unaligned=" + secondSuccessor
      ];
      for (const { args, diagnostic } of [
        {
          args: [
            "--relations-for",
            firstSuccessor,
            "--relation",
            "拆分=use-generated-cli"
          ],
          diagnostic: /Every successor in a 拆分 transaction/u
        },
        {
          args: [
            "--relations-for",
            firstSuccessor,
            "--relation",
            "拆分=use-generated-cli",
            "--relations-for",
            secondSuccessor,
            "--relation",
            "拆分=260710-use-source-cli"
          ],
          diagnostic: /must use the same predecessor/u
        },
        {
          args: [
            "--relations-for",
            firstSuccessor,
            "--relation",
            "拆分=use-generated-cli",
            "--relation",
            "修订=260710-use-source-cli",
            "--relations-for",
            secondSuccessor,
            "--relation",
            "拆分=use-generated-cli"
          ],
          diagnostic: /Every successor in a 拆分 transaction/u
        }
      ]) {
        const result = await runSourceLifecycleCli([
          "evolve",
          ...selected,
          ...args,
          "--root",
          workspaceRoot
        ]);
        assert.equal(result.exitCode, 1);
        assert.equal(result.stdout, "");
        assert.match(result.stderr, diagnostic);
        assert.equal(await fs.readFile(firstPath, "utf8"), firstBefore);
        assert.equal(await fs.readFile(secondPath, "utf8"), secondBefore);
        assert.equal(await fs.readFile(indexPath, "utf8"), indexBefore);
      }
    }
  ));

test("generated Node CLI accepts grouped evolve argv through preflight", () =>
  withFixtureWorkspace("generated-grouped-evolve", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const result = spawnSync(
      "node",
      [
        generatedCliPath,
        "evolve",
        "--successor",
        "aligned=" + established.alignedRelativePath,
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--relations-for",
        established.alignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--relations-for",
        established.unalignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--keep-unrecorded-history",
        "--preflight",
        "--root",
        workspaceRoot
      ],
      { cwd: workspaceRoot, encoding: "utf8" }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Relation review \(preflight\):/);
    assert.equal(result.stderr, "");
  }));

test("grouped evolve rolls back without printing a committed review after publication failure", () =>
  withFixtureWorkspace("grouped-evolve-recovery", async (workspaceRoot) => {
    const established = await establishClosedSplit(workspaceRoot);
    const firstPath = decisionFilePath(
      workspaceRoot,
      established.alignedRelativePath
    );
    const secondPath = decisionFilePath(
      workspaceRoot,
      established.unalignedRelativePath
    );
    const firstBefore = await fs.readFile(firstPath, "utf8");
    const secondBefore = await fs.readFile(secondPath, "utf8");
    const indexBefore = await fs.readFile(established.indexPath, "utf8");
    const descriptor = Object.getOwnPropertyDescriptor(fs, "rename");
    assert.ok(descriptor);
    const rename = fs.rename.bind(fs);
    Object.defineProperty(fs, "rename", {
      ...descriptor,
      value: async (from: string, to: string): Promise<void> => {
        await rename(from, to);
        if (to === established.indexPath) {
          throw Object.assign(new Error("grouped index publication failure"), {
            code: "EIO"
          });
        }
      }
    });
    try {
      const result = await runSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + established.alignedRelativePath,
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--relations-for",
        established.alignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--relation-summary",
        established.coarseRelativePath + "=恢复前摘要",
        "--relations-for",
        established.unalignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--relation-summary",
        established.coarseRelativePath + "=恢复后摘要",
        "--root",
        workspaceRoot
      ]);
      assert.equal(result.exitCode, 1);
      assert.equal(result.stdout, "");
      assert.doesNotMatch(result.stdout, /Relation review \(committed\):/);
      assert.match(result.stderr, /grouped index publication failure/);
    } finally {
      Object.defineProperty(fs, "rename", descriptor);
    }
    assert.equal(await fs.readFile(firstPath, "utf8"), firstBefore);
    assert.equal(await fs.readFile(secondPath, "utf8"), secondBefore);
    assert.equal(await fs.readFile(established.indexPath, "utf8"), indexBefore);
  }));
