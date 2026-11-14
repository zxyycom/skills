import assert from "node:assert/strict";
import test from "node:test";
import { gateToolScopes } from "../../impact-tools.ts";
import {
  prepareChangedFixtureActivation,
  prepareFixtureActivation,
  publishFixtureReceipts,
  withImpactFixture,
  writeImpactFixture
} from "../impact-test-support.ts";

test("incremental Gate closes video source resources and distribution inputs under one capability", async () => {
  await withImpactFixture(async (fixture) => {
    await writeImpactFixture(
      fixture.directory,
      ".gitignore",
      ".log/\n*.fixture\n"
    );
    for (const input of [
      "tools/video-understanding/src/video.ts",
      "tools/video-understanding/resources/scripts/media.py",
      "tools/video-understanding/resources/scripts/runtime.env",
      "tools/video-understanding/resources/runtime/ocr-profiles.json",
      "tools/video-understanding/resources/runtime/requirements.txt",
      "tools/video-understanding/resources/runtime/local.fixture",
      "tools/video-understanding/tests/fixtures/process.ts",
      "tools/video-understanding/tests/checks/source-cli.ts",
      "scripts/accept-video-windows.ts",
      "scripts/video-artifact/run.test.ts",
      "skills/video-understanding/scripts/video.ts",
      "skills/video-understanding/scripts/runtime/tools/video-understanding/src/video.ts",
      "skills/video-understanding/runtime/prepare-ocr.py",
      "skills/video-understanding/package.json",
      "skills/video-understanding/pnpm-lock.yaml"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, [], input);
      assert.ok(plan.activeToolIds.includes("video-understanding"), input);
      for (const checkId of [
        "test:video-understanding:source-contracts",
        "test:video-understanding:source-cli",
        "test:video-understanding:public-distribution",
        "script:check:skill-updaters"
      ]) {
        assert.equal(
          plan.decisions.find((decision) => decision.checkId === checkId)
            ?.action,
          "execute",
          `${input}: ${checkId}`
        );
      }
      for (const checkId of [
        ...(input.startsWith("scripts/")
          ? []
          : ["test:novel-cards:card-and-query-contract"]),
        "script:test:index-runtime"
      ]) {
        assert.equal(
          plan.decisions.find((decision) => decision.checkId === checkId)
            ?.action,
          "reuse",
          `${input}: ${checkId}`
        );
      }
      assert.equal(
        (await publishFixtureReceipts(fixture, plan)).published,
        true
      );
      assert.equal(
        (await prepareFixtureActivation(fixture)).activeCheckIds.length,
        0,
        input
      );
    }
  });
});

test("record Rust test fixture changes invalidate the Cargo receipt without widening metric ownership", async () => {
  await withImpactFixture(async (fixture) => {
    const input = "tools/record-cli/tests/fixtures/investigation-same.md";
    const plan = await prepareChangedFixtureActivation(fixture, input);
    assert.deepEqual(gateToolScopes["record-rust"].files, [
      "tools/record-cli/**",
      "tools/record-contracts/**",
      "scripts/prepare-record-native.ts",
      "scripts/publish-native-skills.ts",
      "scripts/record-native-cli.ts",
      "scripts/lib/record-native/**"
    ]);
    assert.ok(
      gateToolScopes["record-rust"].files.includes("tools/record-cli/**")
    );
    assert.equal(plan.kind, "incremental");
    assert.deepEqual(plan.snapshot.unclassifiedPaths, []);
    assert.ok(plan.activeToolIds.includes("record-rust"));
    assert.equal(
      plan.decisions.find((item) => item.checkId === "test:record-rust:cargo")
        ?.action,
      "execute"
    );
    assert.equal(
      plan.decisions.find(
        (item) => item.checkId === "test:novel-cards:card-and-query-contract"
      )?.action,
      "reuse"
    );
  });
});

test("native publisher and frozen consumer dependencies invalidate their receipts", async () => {
  await withImpactFixture(async (fixture) => {
    for (const [input, checkId] of [
      ["scripts/publish-native-skills.ts", "test:record-rust:runtime"],
      [
        "scripts/lib/record-native/tests/candidate-publish-fixture.ts",
        "script:test:skill-updater"
      ],
      [
        "scripts/lib/record-native/candidate-build-recipe.ts",
        "script:test:skill-updater"
      ]
    ] as const) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, [], input);
      assert.equal(
        plan.decisions.find((item) => item.checkId === checkId)?.action,
        "execute",
        input
      );
      assert.equal(
        plan.decisions.find(
          (item) => item.checkId === "script:test:index-runtime"
        )?.action,
        "reuse",
        input
      );
    }
  });
});

test("record native runtime and build inputs invalidate affected delivery checks", async () => {
  await withImpactFixture(async (fixture) => {
    for (const input of [
      "scripts/lib/record-native/runtime.ts",
      "tools/record-cli/delivery/build.ts",
      ".github/workflows/package-skills.yml"
    ]) {
      const plan = await prepareChangedFixtureActivation(fixture, input);
      assert.equal(plan.kind, "incremental");
      assert.deepEqual(plan.snapshot.unclassifiedPaths, []);
      if (input === "scripts/lib/record-native/runtime.ts") {
        assert.ok(
          gateToolScopes["test-evidence-project"].additionalInputs.includes(
            input
          )
        );
        assert.equal(
          plan.decisions.find(
            (item) =>
              item.checkId === "test:test-evidence:project-reference-check"
          )?.action,
          "execute"
        );
      }
      for (const checkId of [
        "test:record-rust:delivery",
        "test:record-rust:runtime",
        "script:test:skill-package-hash"
      ])
        assert.equal(
          plan.decisions.find((item) => item.checkId === checkId)?.action,
          "execute",
          `${input}: ${checkId}`
        );
    }
  });
});
