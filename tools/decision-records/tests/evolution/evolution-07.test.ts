import {
  assert,
  establishClosedReallocation,
  establishClosedSplit,
  findIndexEntry,
  readIndex,
  runSuccessfulSourceLifecycleCli,
  test,
  validateDecisionRecords,
  withFixtureWorkspace
} from "./support.ts";

test("evolve replaces each selected split successor with its own grouped summary", () =>
  withFixtureWorkspace(
    "evolve-grouped-split-summaries",
    async (workspaceRoot) => {
      const established = await establishClosedSplit(workspaceRoot);
      const output = await runSuccessfulSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + established.alignedRelativePath,
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--relations-for=" + established.alignedRelativePath,
        "--relation=拆分=" + established.coarseRelativePath,
        "--relation-summary=" +
          established.coarseRelativePath +
          "=承接当前边界=并保留等号",
        "--relations-for",
        established.unalignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--relation-summary",
        established.coarseRelativePath + "=承接未来边界",
        "--root",
        workspaceRoot
      ]);
      assert.match(output, /Relation review \(committed\):/);
      assert.match(output, /action=replace/);
      assert.match(output, /承接当前边界=并保留等号/);
      assert.match(output, /承接未来边界/);

      const index = await readIndex(established.indexPath);
      assert.deepEqual(
        findIndexEntry(index, established.alignedRelativePath).relations,
        [
          {
            summary: "承接当前边界=并保留等号",
            target: established.coarseRelativePath,
            type: "拆分"
          }
        ]
      );
      assert.deepEqual(
        findIndexEntry(index, established.unalignedRelativePath).relations,
        [
          {
            summary: "承接未来边界",
            target: established.coarseRelativePath,
            type: "拆分"
          }
        ]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
      const removedSummary = await runSuccessfulSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + established.alignedRelativePath,
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--relations-for",
        established.alignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.match(
        removedSummary,
        new RegExp(
          "- " +
            established.alignedRelativePath +
            " action=replace\\n" +
            "  before relations:\\n" +
            "    - " +
            established.alignedRelativePath +
            " --拆分--> " +
            established.coarseRelativePath +
            ': "承接当前边界=并保留等号"\\n' +
            "  after relations:\\n" +
            "    - " +
            established.alignedRelativePath +
            " --拆分--> " +
            established.coarseRelativePath +
            ": \\[无摘要\\]",
          "u"
        )
      );
      assert.match(
        removedSummary,
        new RegExp(
          "- " +
            established.unalignedRelativePath +
            " action=unchanged\\n" +
            "  before relations:\\n" +
            "    - " +
            established.unalignedRelativePath +
            " --拆分--> " +
            established.coarseRelativePath +
            ': "承接未来边界"\\n' +
            "  after relations:\\n" +
            "    - " +
            established.unalignedRelativePath +
            " --拆分--> " +
            established.coarseRelativePath +
            ': "承接未来边界"\\n' +
            "  changes: unchanged",
          "u"
        )
      );
      const afterRemoval = await readIndex(established.indexPath);
      assert.deepEqual(
        findIndexEntry(afterRemoval, established.alignedRelativePath).relations,
        [{ target: established.coarseRelativePath, type: "拆分" }]
      );
      assert.deepEqual(
        findIndexEntry(afterRemoval, established.unalignedRelativePath)
          .relations,
        [
          {
            summary: "承接未来边界",
            target: established.coarseRelativePath,
            type: "拆分"
          }
        ]
      );
      const unchanged = await runSuccessfulSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + established.alignedRelativePath,
        "--successor",
        "unaligned=" + established.unalignedRelativePath,
        "--relations-for",
        established.alignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--root",
        workspaceRoot
      ]);
      assert.match(unchanged, /action=unchanged/);
    }
  ));

test("evolve preserves sparse grouped reallocation relation sets independently", () =>
  withFixtureWorkspace(
    "evolve-grouped-sparse-reallocation",
    async (workspaceRoot) => {
      const established = await establishClosedReallocation(workspaceRoot);
      const output = await runSuccessfulSourceLifecycleCli([
        "evolve",
        "--successor",
        "aligned=" + established.firstSuccessorRelativePath,
        "--successor",
        "unaligned=" + established.secondSuccessorRelativePath,
        "--relations-for",
        established.firstSuccessorRelativePath,
        "--relation",
        "重划=" + established.secondPredecessorRelativePath,
        "--relation-summary",
        established.secondPredecessorRelativePath + "=承接第二前序",
        "--relation",
        "重划=" + "use-generated-cli",
        "--relation-summary",
        "use-generated-cli=承接当前前序",
        "--relations-for",
        established.secondSuccessorRelativePath,
        "--relation",
        "重划=use-generated-cli",
        "--relation-summary",
        "use-generated-cli=保留窄分量",
        "--root",
        workspaceRoot
      ]);
      assert.match(output, /Relation review \(committed\):/);
      const index = await readIndex(established.indexPath);
      assert.deepEqual(
        findIndexEntry(index, established.firstSuccessorRelativePath).relations,
        [
          {
            summary: "承接第二前序",
            target: established.secondPredecessorRelativePath,
            type: "重划"
          },
          {
            summary: "承接当前前序",
            target: "use-generated-cli",
            type: "重划"
          }
        ]
      );
      assert.deepEqual(
        findIndexEntry(index, established.secondSuccessorRelativePath)
          .relations,
        [
          {
            summary: "保留窄分量",
            target: "use-generated-cli",
            type: "重划"
          }
        ]
      );
      assert.deepEqual(
        (await validateDecisionRecords({ workspaceRoot })).errors,
        []
      );
    }
  ));
