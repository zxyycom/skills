import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createRepositoryTestEvidenceSnapshot,
  parseSkippedJUnit,
  parseRepositoryTestCommands,
  repositoryTestEvidenceSource,
  writeRepositoryTestEvidenceSnapshot
} from "./snapshot.ts";

import { withSnapshotFixture } from "./test-fixture.ts";

const fixtureTest = [
  'import test from "node:test";',
  'test("fixture registration", () => {});',
  ""
].join("\n");

test("repository test commands use the restricted Bun and Node forms", async () => {
  await withSnapshotFixture(
    {
      "test:bun": "bun test ./tests/bun.test.ts ./tests/second.test.ts",
      "test:node": "node --test ./tests/node.test.ts"
    },
    {
      "tests/bun.test.ts": fixtureTest,
      "tests/node.test.ts": fixtureTest,
      "tests/second.test.ts": fixtureTest
    },
    async (root) => {
      assert.deepEqual(await parseRepositoryTestCommands(root), [
        {
          files: ["./tests/bun.test.ts", "./tests/second.test.ts"],
          original: "bun test ./tests/bun.test.ts ./tests/second.test.ts",
          runner: "bun",
          scriptName: "test:bun"
        },
        {
          files: ["./tests/node.test.ts"],
          original: "node --test ./tests/node.test.ts",
          runner: "node",
          scriptName: "test:node"
        }
      ]);
    }
  );
  const invalidCommands = [
    "bun test ./tests/*.test.ts",
    "bun test ./tests/fixture.test.ts > report.xml",
    "bun test ./tests/fixture.test.ts | cat",
    "vitest run ./tests/fixture.test.ts"
  ];
  for (const command of invalidCommands) {
    await withSnapshotFixture(
      { "test:invalid": command },
      { "tests/fixture.test.ts": fixtureTest },
      async (root) => {
        await assert.rejects(
          parseRepositoryTestCommands(root),
          /unsupported command shape|explicit project-relative files|must be bun test/u
        );
      }
    );
  }
});

test("JUnit registration accepts only complete skipped reports", () => {
  const report = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<testsuites tests="1">',
    '  <testsuite tests="1">',
    '    <testcase file="scripts/example.test.ts" name="registered test" line="7">',
    "      <skipped />",
    "    </testcase>",
    "  </testsuite>",
    "</testsuites>"
  ].join("\n");
  assert.deepEqual(
    parseSkippedJUnit(report, new Set(["scripts/example.test.ts"])),
    [{ file: "scripts/example.test.ts", line: "7", name: "registered test" }]
  );
  assert.throws(
    () =>
      parseSkippedJUnit(
        report.replace("<skipped />", "<failure />"),
        new Set(["scripts/example.test.ts"])
      ),
    /failures or errors/u
  );
  assert.throws(
    () =>
      parseSkippedJUnit(
        report.replace("<skipped />", ""),
        new Set(["scripts/example.test.ts"])
      ),
    /skipped status/u
  );
  assert.throws(
    () =>
      parseSkippedJUnit(
        report.replace(
          '<testsuites tests="1">',
          '<!DOCTYPE x><testsuites tests="1">'
        ),
        new Set(["scripts/example.test.ts"])
      ),
    /DTD/u
  );
  assert.throws(
    () => parseSkippedJUnit('<testsuites tests="0" />', new Set()),
    /contains no testcases/u
  );
});

test("producer excludes its requested in-workspace snapshot output from source inputs", async () => {
  await withSnapshotFixture(
    { "test:fixture": "bun test ./tests/fixture.test.ts" },
    {
      "scripts/fixture-source.ts": "export const fixture = true;\n",
      "tests/fixture.test.ts": fixtureTest
    },
    async (root) => {
      const output = "scripts/snapshot-output.json";
      const snapshot = await writeRepositoryTestEvidenceSnapshot(root, output);
      const expected = await repositoryTestEvidenceSource(root, {
        outputPath: output
      });
      assert.equal(snapshot.source.revision, expected.revision);
      const parsed = JSON.parse(
        await fs.readFile(path.join(root, output), "utf8")
      ) as { source: { revision: string } };
      assert.equal(parsed.source.revision, expected.revision);
    }
  );
});

test("producer rejects unsupported commands and preserves exclusive outputs", async () => {
  await withSnapshotFixture(
    {
      "test:fixture": "bun test ./tests/fixture.test.ts",
      "test:unsupported": "bun test --watch ./tests/fixture.test.ts"
    },
    { "tests/fixture.test.ts": fixtureTest },
    async (root) => {
      await assert.rejects(
        createRepositoryTestEvidenceSnapshot({ workspaceRoot: root }),
        /unsupported|explicit project-relative/u
      );
      const output = path.join(root, "snapshot.json");
      await fs.writeFile(output, "existing\n", "utf8");
      await assert.rejects(
        writeRepositoryTestEvidenceSnapshot(root, output),
        /exclusive snapshot output/u
      );
      assert.equal(await fs.readFile(output, "utf8"), "existing\n");
    }
  );
});

test("producer registers Node-targeted files through Bun without changing their selector", async () => {
  await withSnapshotFixture(
    { "test:node": "node --test ./tests/node-only.test.ts" },
    {
      "tests/node-only.test.ts": [
        'import test from "node:test";',
        'test("Node-only registration", () => {});',
        ""
      ].join("\n")
    },
    async (root) => {
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      assert.equal(snapshot.entities.length, 1);
      assert.deepEqual(snapshot.entities[0]?.locators, [
        "node --test ./tests/node-only.test.ts :: tests/node-only.test.ts > Node-only registration",
        "tests/node-only.test.ts > Node-only registration"
      ]);
    }
  );
});

test("producer collects a finite literal matrix with dynamic registered names", async () => {
  await withSnapshotFixture(
    { "test:matrix": "bun test ./tests/matrix.test.ts" },
    {
      "tests/matrix.test.ts": [
        'import test from "node:test";',
        'for (const flavor of ["red", "blue"]) {',
        "  test(`matrix ${flavor}`, () => {});",
        "}",
        ""
      ].join("\n")
    },
    async (root) => {
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      assert.deepEqual(snapshot.entities.map((entity) => entity.name).sort(), [
        "matrix blue",
        "matrix red"
      ]);
    }
  );
});

test("producer merges duplicate registrations from distinct test containers", async () => {
  await withSnapshotFixture(
    {
      "test:first": "bun test ./tests/shared.test.ts",
      "test:second": "bun test ./tests/shared.test.ts"
    },
    { "tests/shared.test.ts": fixtureTest },
    async (root) => {
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      assert.equal(snapshot.entities.length, 1);
      assert.deepEqual(snapshot.entities[0]?.locators, [
        'bun test --test-name-pattern="^fixture registration$" ./tests/shared.test.ts',
        "bun test ./tests/shared.test.ts :: tests/shared.test.ts > fixture registration",
        "tests/shared.test.ts > fixture registration"
      ]);
    }
  );
});

test("producer refuses dynamic names, nested registrations, missing reports, and registration failures", async () => {
  const failures = [
    {
      expected: /must map to exactly one static test declaration/u,
      files: {
        "tests/dynamic.test.ts": [
          'import test from "node:test";',
          'const name = "dynamic registration";',
          "test(name, () => {});",
          ""
        ].join("\n")
      },
      scripts: { "test:dynamic": "bun test ./tests/dynamic.test.ts" }
    },
    {
      expected: /unsupported registration shape/u,
      files: {
        "tests/nested.test.ts": [
          'import test from "node:test";',
          'test("parent", () => { test("child", () => {}); });',
          ""
        ].join("\n")
      },
      scripts: { "test:nested": "bun test ./tests/nested.test.ts" }
    },
    {
      expected: /did not publish a JUnit report/u,
      files: { "tests/empty.test.ts": 'import test from "node:test";\n' },
      scripts: { "test:empty": "bun test ./tests/empty.test.ts" }
    },
    {
      expected: /Bun registration failed/u,
      files: {
        "tests/broken.test.ts": 'throw new Error("registration failure");\n'
      },
      scripts: { "test:broken": "bun test ./tests/broken.test.ts" }
    }
  ] as const;
  for (const fixture of failures) {
    await withSnapshotFixture(fixture.scripts, fixture.files, async (root) => {
      await assert.rejects(
        createRepositoryTestEvidenceSnapshot({ workspaceRoot: root }),
        fixture.expected
      );
    });
  }
});

test("producer refuses to publish after a registration mutates source inputs", async () => {
  await withSnapshotFixture(
    { "test:drift": "bun test ./tests/drift.test.ts" },
    {
      "scripts/source-input.ts": "export const initial = true;\n",
      "tests/drift.test.ts": [
        'import fs from "node:fs";',
        'import test from "node:test";',
        'fs.writeFileSync("scripts/source-input.ts", "export const changed = true;\\n");',
        'test("registration detects drift", () => {});',
        ""
      ].join("\n")
    },
    async (root) => {
      await assert.rejects(
        createRepositoryTestEvidenceSnapshot({ workspaceRoot: root }),
        /source inputs changed while collecting/u
      );
    }
  );
});
