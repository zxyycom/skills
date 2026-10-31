import type {
  DecisionRelationOverrideGroup,
  DecisionRelation
} from "../../../src/types.ts";
import { assertLifecycleRejected, evolutionRequest } from "./domain-support.ts";
import { decisionIdForTest } from "../../support/support-record-fixture.ts";
import {
  assert,
  candidateDecisionBody,
  decisionFilePath,
  establishClosedSplit,
  findIndexEntry,
  fs,
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
        "--source",
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

test("evolve rejects invalid grouped sources and summaries without writing", async () => {
  const id = decisionIdForTest;
  const sources = [
    { id: "260710-prior", status: "archived" as const },
    { id: "260901-successor" }
  ];
  const cases: [DecisionRelationOverrideGroup[], RegExp][] = [
    [
      [
        {
          source: id("prior"),
          relationOverride: {
            kind: "replace" as const,
            relations: [{ type: "修订" as const, target: id("prior") }]
          }
        }
      ],
      /not a selected successor/
    ],
    [
      [
        {
          source: id("successor"),
          relationOverride: {
            kind: "replace" as const,
            relations: [{ type: "修订" as const, target: id("prior") }],
            relationSummaries: [
              { target: id("260901-successor"), summary: "失配说明" }
            ]
          }
        }
      ],
      /relation-summary target is not in the complete relation set/
    ],
    [
      [
        {
          source: id("successor"),
          relationOverride: {
            kind: "replace" as const,
            relations: [
              { type: "修订" as const, target: id("260710-prior") },
              { type: "替代" as const, target: id("prior") }
            ]
          }
        }
      ],
      /resolve to the same direct predecessor target/
    ],
    [
      [
        {
          source: id("260901-successor"),
          relationOverride: { kind: "replace" as const, relations: [] }
        },
        {
          source: id("successor"),
          relationOverride: { kind: "replace" as const, relations: [] }
        }
      ],
      /same selected successor more than once/
    ]
  ];
  for (const [groups, expected] of cases) {
    await assertLifecycleRejected(
      sources,
      evolutionRequest(["260901-successor"], {
        relationOverrideGroups: groups
      }),
      expected
    );
  }
});

test("evolve rejects incomplete, mismatched, and impure grouped replacements without writing", async () => {
  const id = decisionIdForTest;
  const sources = [
    { id: "prior", status: "active" as const },
    { id: "other", status: "archived" as const },
    { id: "first", relations: [{ type: "修订", target: "prior" }] },
    { id: "second", relations: [{ type: "修订", target: "other" }] }
  ];
  const cases: [DecisionRelation[], DecisionRelation[] | undefined, RegExp][] =
    [
      [
        [{ type: "拆分" as const, target: id("prior") }],
        undefined,
        /Every successor in a 拆分 transaction/
      ],
      [
        [{ type: "拆分" as const, target: id("prior") }],
        [{ type: "拆分" as const, target: id("other") }],
        /must use the same predecessor/
      ],
      [
        [
          { type: "拆分" as const, target: id("prior") },
          { type: "修订" as const, target: id("other") }
        ],
        [{ type: "拆分" as const, target: id("prior") }],
        /Every successor in a 拆分 transaction/
      ]
    ];
  for (const [first, second, expected] of cases) {
    await assertLifecycleRejected(
      sources,
      evolutionRequest(["first", "second"], {
        relationOverrideGroups: [
          {
            source: id("first"),
            relationOverride: { kind: "replace", relations: first }
          },
          ...(second === undefined
            ? []
            : [
                {
                  source: id("second"),
                  relationOverride: {
                    kind: "replace" as const,
                    relations: second
                  }
                }
              ])
        ]
      }),
      expected
    );
  }
});

test("grouped evolve preserves committed sources and index without a success review when publication writer rejects", () =>
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
        "--source",
        established.alignedRelativePath,
        "--relation",
        "拆分=" + established.coarseRelativePath,
        "--relation-summary",
        established.coarseRelativePath + "=恢复前摘要",
        "--source",
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
      assert.match(result.stderr, /outcome: partial-or-unknown/);
    } finally {
      Object.defineProperty(fs, "rename", descriptor);
    }
    const firstAfter = await fs.readFile(firstPath, "utf8");
    const secondAfter = await fs.readFile(secondPath, "utf8");
    assert.notEqual(firstAfter, firstBefore);
    assert.notEqual(secondAfter, secondBefore);
    assert.match(firstAfter, /summary: 恢复前摘要/);
    assert.match(secondAfter, /summary: 恢复后摘要/);
    assert.notEqual(
      await fs.readFile(established.indexPath, "utf8"),
      indexBefore
    );
    const index = await readIndex(established.indexPath);
    assert.deepEqual(
      findIndexEntry(index, established.alignedRelativePath).relations,
      [
        {
          target: established.coarseRelativePath,
          type: "拆分",
          summary: "恢复前摘要"
        }
      ]
    );
    assert.deepEqual(
      findIndexEntry(index, established.unalignedRelativePath).relations,
      [
        {
          target: established.coarseRelativePath,
          type: "拆分",
          summary: "恢复后摘要"
        }
      ]
    );
  }));
