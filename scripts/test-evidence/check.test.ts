import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { syncTestEvidenceIndex } from "../../tools/test-evidence/src/cli.ts";
import { checkRepositoryTestEvidence } from "./check.ts";
import { cargoTestId } from "./snapshot/snapshot-cargo.ts";
import { cargoTestCommand } from "./snapshot/snapshot-commands.ts";
import { createRepositoryTestEvidenceSnapshot } from "./snapshot/snapshot.ts";
import { withSnapshotFixture } from "./test-fixture.ts";

test("registration identities retain a direct file and full test name", async () => {
  await withSnapshotFixture(
    { "test:locator": "bun test ./tests/locator.test.ts" },
    {
      "tests/locator.test.ts": [
        'import test from "node:test";',
        'test("full registration name", () => {});',
        ""
      ].join("\n")
    },
    async (root) => {
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      assert.deepEqual(snapshot.entities, [
        {
          id: "test:2a3d620856de173fa17082eb2b6b5dfa8491f20a96d5bf1a0c1cc5c6e66fb4ef",
          locators: [
            'bun test --test-name-pattern="^full registration name$" ./tests/locator.test.ts',
            "bun test ./tests/locator.test.ts :: tests/locator.test.ts > full registration name",
            "tests/locator.test.ts > full registration name"
          ],
          name: "full registration name"
        }
      ]);
    }
  );
});

test("project check rejects a registered test without a Case", async () => {
  await withSnapshotFixture(
    {
      "test:fixture":
        "bun test ./tests/covered.test.ts ./tests/uncovered.test.ts"
    },
    {
      "tests/covered.test.ts":
        'import test from "node:test";\ntest("covered", () => {});\n',
      "tests/uncovered.test.ts":
        'import test from "node:test";\ntest("uncovered", () => {});\n'
    },
    async (root) => {
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      const covered = snapshot.entities.find(
        (entity) => entity.name === "covered"
      );
      assert.ok(covered);
      const cases = path.join(root, "docs", "test-evidence", "cases");
      await fs.mkdir(cases, { recursive: true });
      await fs.writeFile(
        path.join(cases, "fixture.md"),
        `### Case PROJECT-TEST-COVERAGE-001: only one test has a Case\n\nTests:\n- \`${covered.id}\`\n\nContract:\n- test coverage is checked\n\nProves:\n- an uncovered test blocks the project check\n`
      );
      const synced = await syncTestEvidenceIndex({
        mode: "write",
        workspaceRoot: root
      });
      assert.equal(synced.status, "ok", JSON.stringify(synced));
      const result = await checkRepositoryTestEvidence(root);
      assert.equal(result.status, "error");
      assert.equal(result.entityCount, 2);
      assert.deepEqual(
        result.diagnostics.map((diagnostic) => diagnostic.code),
        ["project.entity-without-case"]
      );
      const snapshotCacheDirectory = path.join(
        root,
        ".log/vibe-check/cache/test-evidence-snapshots-v1"
      );
      const cacheFiles = await fs.readdir(snapshotCacheDirectory);
      assert.equal(cacheFiles.length, 1);
      const cachePath = path.join(snapshotCacheDirectory, cacheFiles[0] ?? "");
      const cacheIdentity = (await fs.stat(cachePath)).ino;
      const uncovered = snapshot.entities.find(
        (entity) => entity.name === "uncovered"
      );
      assert.ok(uncovered);
      await fs.writeFile(
        path.join(cases, "uncovered.md"),
        `### Case PROJECT-TEST-COVERAGE-002: the remaining test has a Case\n\nTests:\n- \`${uncovered.id}\`\n\nContract:\n- every registered test has a Case\n\nProves:\n- complete coverage passes the project check\n`
      );
      assert.equal(
        (await syncTestEvidenceIndex({ mode: "write", workspaceRoot: root }))
          .status,
        "ok"
      );
      assert.deepEqual(await checkRepositoryTestEvidence(root), {
        diagnostics: [],
        entityCount: 2,
        status: "ok"
      });
      assert.equal((await fs.stat(cachePath)).ino, cacheIdentity);
    }
  );
});

test("platform-specific reference classification remains strict", async () => {
  const { classifyPlatformReferences } = await import("./platform-entities.ts");
  const entries = [
    { id: "unix-node", platform: "unix" as const, locator: "unix" },
    { id: "windows-node", platform: "windows" as const, locator: "windows" }
  ];
  assert.deepEqual(
    classifyPlatformReferences(entries, "win32", new Set(["windows-node"]), [
      "unix-node"
    ]),
    {
      unavailable: ["unix-node"],
      invalid: [],
      stale: [],
      unexpected: []
    }
  );
  assert.deepEqual(
    classifyPlatformReferences(entries, "linux", new Set(["unix-node"]), [
      "windows-node",
      "unknown"
    ]),
    {
      unavailable: ["windows-node"],
      invalid: ["unknown"],
      stale: [],
      unexpected: []
    }
  );
  assert.deepEqual(
    classifyPlatformReferences(entries, "win32", new Set(["unix-node"]), [
      "windows-node"
    ]),
    {
      unavailable: [],
      invalid: ["windows-node"],
      stale: ["windows-node"],
      unexpected: ["unix-node"]
    }
  );
  assert.deepEqual(
    classifyPlatformReferences(entries, "other", new Set(), ["unix-node"]),
    {
      unavailable: [],
      invalid: ["unix-node"],
      stale: [],
      unexpected: []
    }
  );
});

test("project check reports foreign references but blocks unknown ones", async () => {
  const foreignPlatform = process.platform === "win32" ? "unix" : "windows";
  const name = "conditional";
  const id = cargoTestId("test\0example", name);

  await withSnapshotFixture(
    { "test:fixture": "bun test ./tests/covered.test.ts" },
    {
      "tests/covered.test.ts":
        'import test from "node:test";\ntest("covered", () => {});\n',
      "tools/record-cli/src/lib.rs": '[package]\nname = "fixture"\n'
    },
    async (root) => {
      const registryPath = path.join(
        root,
        "scripts/test-evidence/platform-entities.json"
      );
      await fs.mkdir(path.dirname(registryPath), { recursive: true });
      await fs.writeFile(
        registryPath,
        JSON.stringify({
          version: 2,
          entities: [
            {
              platform: foreignPlatform,
              locator: `cargo:test:example > ${name}`
            }
          ]
        })
      );
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      const local = snapshot.entities[0]!.id;
      const cases = path.join(root, "docs/test-evidence/cases");
      await fs.mkdir(cases, { recursive: true });
      const write = async (foreign: string) => {
        const tests = [foreign, local]
          .sort()
          .map((value) => `- \`${value}\``)
          .join("\n");
        await fs.writeFile(
          path.join(cases, "fixture.md"),
          `### Case PROJECT-PLATFORM-TEST-001: platform references\n\nTests:\n${tests}\n\nContract:\n- References must be known.\n\nProves:\n- Foreign platform references are identified.\n`
        );
        assert.equal(
          (await syncTestEvidenceIndex({ mode: "write", workspaceRoot: root }))
            .status,
          "ok"
        );
      };
      await write(id);
      const result = await checkRepositoryTestEvidence(root);
      assert.equal(result.status, "ok", JSON.stringify(result));
      assert.deepEqual(result.unavailableTestIds, [id]);
      await fs.writeFile(
        path.join(root, "tools/record-cli/src/lib.rs"),
        "changed"
      );
      const changed = await checkRepositoryTestEvidence(root);
      assert.equal(changed.status, "ok", JSON.stringify(changed));
      assert.deepEqual(changed.unavailableTestIds, [id]);
      await write(`test:${"f".repeat(64)}`);
      const invalid = await checkRepositoryTestEvidence(root);
      assert.equal(invalid.status, "error");
      assert.equal(
        invalid.diagnostics[0]?.code,
        "project.references-references-invalid"
      );
    }
  );
});

test("project check catches missing and wrongly assigned Cargo declarations from native listings", async () => {
  const platform = process.platform === "win32" ? "windows" : "unix";
  const otherPlatform = platform === "unix" ? "windows" : "unix";
  const registry = "scripts/test-evidence/platform-entities.json";
  const source = "tools/record-cli/src/lib.rs";
  const decl = (target: typeof platform) =>
    JSON.stringify({
      version: 2,
      entities: [
        { platform: target, locator: "cargo:lib:record_cli > conditional" }
      ]
    });
  const rust = (target: typeof platform) =>
    `#[test] fn common() {}\n#[cfg(${target})] #[test] fn conditional() {}\n`;
  await withSnapshotFixture(
    {
      "test:fixture": "bun test ./tests/covered.test.ts",
      "test:record-rust": cargoTestCommand
    },
    {
      [registry]: decl(platform),
      [source]: rust(platform),
      "tools/record-cli/.gitignore": "target/\n",
      "tools/record-cli/Cargo.toml":
        '[package]\nname = "record-cli"\nversion = "0.1.0"\nedition = "2021"\n',
      "tools/record-cli/Cargo.lock":
        'version = 4\n\n[[package]]\nname = "record-cli"\nversion = "0.1.0"\n',
      "tests/covered.test.ts":
        'import test from "node:test";\ntest("covered", () => {});\n'
    },
    async (root) => {
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      assert.equal(snapshot.entities.length, 3);
      const cases = path.join(root, "docs/test-evidence/cases");
      await fs.mkdir(cases, { recursive: true });
      const tests = snapshot.entities.map(({ id }) => `- \`${id}\``).join("\n");
      await fs.writeFile(
        path.join(cases, "fixture.md"),
        `### Case PROJECT-PLATFORM-TEST-002: native platform declarations\n\nTests:\n${tests}\n\nContract:\n- The current platform must expose its own declared Cargo node.\n\nProves:\n- The declaration agrees with Cargo's native listing.\n`
      );
      assert.equal(
        (await syncTestEvidenceIndex({ mode: "write", workspaceRoot: root }))
          .status,
        "ok"
      );
      assert.deepEqual(await checkRepositoryTestEvidence(root), {
        diagnostics: [],
        entityCount: 3,
        status: "ok"
      });
      await fs.writeFile(path.join(root, registry), decl(otherPlatform));
      const unexpected = await checkRepositoryTestEvidence(root);
      assert.equal(unexpected.status, "error");
      assert.match(
        unexpected.diagnostics[0]!.message,
        /foreign platform entity unexpectedly present/
      );

      await fs.writeFile(path.join(root, registry), decl(platform));
      await fs.writeFile(path.join(root, source), rust(otherPlatform));
      const stale = await checkRepositoryTestEvidence(root);
      assert.equal(stale.status, "error");
      assert.match(
        stale.diagnostics[0]!.message,
        /declared local platform entity missing/
      );
    }
  );
});

test("project check rejects ignored Cargo source drift on cold and cached snapshots", async () => {
  await withSnapshotFixture(
    { "test:fixture": "bun test ./tests/covered.test.ts" },
    {
      ".gitignore": "tools/record-cli/ignored.rs\n",
      "tests/covered.test.ts":
        'import test from "node:test";\ntest("covered", () => {});\n',
      "tools/record-cli/src/lib.rs": "fn fixture() {}\n"
    },
    async (root) => {
      const ignored = path.join(root, "tools/record-cli/ignored.rs");
      const original = "fn before() {}\n";
      await fs.writeFile(ignored, original);
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      const cases = path.join(root, "docs/test-evidence/cases");
      await fs.mkdir(cases, { recursive: true });
      await fs.writeFile(
        path.join(cases, "fixture.md"),
        `### Case PROJECT-CARGO-DRIFT-001: ignored source\n\nTests:\n- \`${snapshot.entities[0]!.id}\`\n\nContract:\n- Each snapshot is checked against current Cargo inputs.\n\nProves:\n- Ignored source drift is rejected.\n`
      );
      assert.equal(
        (await syncTestEvidenceIndex({ mode: "write", workspaceRoot: root }))
          .status,
        "ok"
      );
      const runWithDrift = async (expectedCode: string) => {
        const read = fs.readFile;
        const descriptor = Object.getOwnPropertyDescriptor(fs, "readFile")!;
        let changed = false;
        Object.defineProperty(fs, "readFile", {
          ...descriptor,
          value: async (...args: Parameters<typeof fs.readFile>) => {
            const bytes = await read(...args);
            if (
              !changed &&
              typeof args[0] === "string" &&
              args[0] === ignored
            ) {
              changed = true;
              await fs.writeFile(ignored, "fn after() {}\n");
            }
            return bytes;
          }
        });
        try {
          const result = await checkRepositoryTestEvidence(root);
          assert.equal(changed, true, "drift was not injected");
          assert.equal(result.status, "error", JSON.stringify(result));
          assert.equal(result.diagnostics[0]?.code, expectedCode);
        } finally {
          Object.defineProperty(fs, "readFile", descriptor);
        }
      };
      await runWithDrift("project.snapshot-failed");
      await fs.writeFile(ignored, original);
      assert.equal((await checkRepositoryTestEvidence(root)).status, "ok");
      const cache = path.join(
        root,
        ".log/vibe-check/cache/test-evidence-snapshots-v1"
      );
      assert.equal((await fs.readdir(cache)).length, 1);
      await runWithDrift("project.source-drift");
    }
  );
});
