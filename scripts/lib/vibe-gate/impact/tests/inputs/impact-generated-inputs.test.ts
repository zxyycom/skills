import assert from "node:assert/strict";
import test from "node:test";
import {
  prepareChangedFixtureActivation,
  withImpactFixture
} from "../impact-test-support.ts";

test("incremental Gate scopes generated file primitives to their fixture and module closure", async () => {
  await withImpactFixture(async (fixture) => {
    for (const [input, action] of [
      ["scripts/lib/generation/generated-file.test.ts", "execute"],
      ["scripts/lib/generation/generated-file.ts", "execute"],
      ["scripts/lib/generation/generated-declaration-cleanup.ts", "execute"],
      [
        "scripts/lib/generation/generated-typescript-declarations.ts",
        "execute"
      ],
      ["scripts/lib/generation/generated-file-header.ts", "execute"],
      ["scripts/lib/generation/source-map.ts", "execute"],
      ["scripts/lib/generation/runtime/source-runtime.ts", "execute"],
      ["scripts/lib/generation/runtime/source-runtime-sync.ts", "execute"],
      ["scripts/lib/project.ts", "execute"],
      ["tools/shared/src/node/filesystem.ts", "execute"],
      ["tools/shared/src/file-text-search/record-search-output.ts", "reuse"],
      ["tools/novel-cards/src/index.ts", "reuse"],
      ["scripts/tests/repository/publish-skills.test.ts", "reuse"]
    ] as const) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(
        plan.decisions.find(
          ({ checkId }) => checkId === "script:test:generated-file"
        )?.action,
        action,
        input
      );
    }
  });
});
