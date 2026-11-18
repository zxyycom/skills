import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { syncTestEvidenceIndex } from "../../tools/test-evidence/src/cli.ts";
import { checkRepositoryTestEvidence } from "./check.ts";
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
  const { createHash } = await import("node:crypto");
  const foreignPlatform = process.platform === "win32" ? "unix" : "windows";
  const name = "conditional";
  const id = `test:${createHash("sha256")
    .update(JSON.stringify(["cargo", "record-cli", "test\0example", name]))
    .digest("hex")}`;

  await withSnapshotFixture(
    { "test:fixture": "bun test ./tests/covered.test.ts" },
    {
      "tests/covered.test.ts":
        'import test from "node:test";\ntest("covered", () => {});\n',
      "tools/record-cli/src/lib.rs": '[package]\nname = "fixture"\n'
    },
    async (root) => {
      const { cargoSourceFingerprint } = await import("./platform-entities.ts");
      const sourceHash = await cargoSourceFingerprint(
        path.join(root, "tools/record-cli")
      );
      const registryPath = path.join(
        root,
        "scripts/test-evidence/platform-entities.json"
      );
      await fs.mkdir(path.dirname(registryPath), { recursive: true });
      await fs.writeFile(
        registryPath,
        JSON.stringify({
          version: 1,
          sourceHash,
          entities: [
            {
              id,
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
      assert.equal(changed.status, "error");
      assert.match(changed.diagnostics[0]!.message, /sourceHash mismatch/);
      await fs.writeFile(
        path.join(root, "tools/record-cli/src/lib.rs"),
        '[package]\nname = "fixture"\n'
      );
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

test("Cargo platform source identity detects deletion, rename and cfg changes", async () => {
  const { cargoSourceFingerprint, readPlatformEntities } =
    await import("./platform-entities.ts");
  const { createHash } = await import("node:crypto");
  const { mkdtemp, mkdir, writeFile, rename, rm } =
    await import("node:fs/promises");
  const os = await import("node:os");
  const root = await mkdtemp(path.join(os.tmpdir(), "platform-source-"));
  try {
    const dir = path.join(root, "tools/record-cli");
    const source = path.join(dir, "src/lib.rs");
    const registry = path.join(
      root,
      "scripts/test-evidence/platform-entities.json"
    );
    await mkdir(path.dirname(source), { recursive: true });
    await mkdir(path.dirname(registry), { recursive: true });
    await writeFile(source, "#[cfg(unix)]\nfn example() {}\n");
    await writeFile(path.join(dir, "Cargo.toml"), "[package]\n");
    const sourceHash = await cargoSourceFingerprint(dir);
    await writeFile(source, "#[cfg(unix)]\r\nfn example() {}\r\n");
    assert.equal(await cargoSourceFingerprint(dir), sourceHash);
    const id = `test:${createHash("sha256")
      .update(
        JSON.stringify([
          "cargo",
          "record-cli",
          "lib\0record_cli",
          "tests::example"
        ])
      )
      .digest("hex")}`;
    const manifest = {
      version: 1,
      sourceHash,
      entities: [
        {
          id,
          platform: "unix",
          locator: "cargo:lib:record_cli > tests::example"
        }
      ]
    };
    await writeFile(registry, JSON.stringify(manifest));
    assert.equal((await readPlatformEntities(root)).length, 1);
    for (const changed of [
      "#[cfg(windows)]\nfn example() {}\n",
      "#[cfg(unix)]\nfn renamed() {}\n"
    ]) {
      await writeFile(source, changed);
      await assert.rejects(readPlatformEntities(root), /sourceHash mismatch/);
    }
    await writeFile(source, "#[cfg(unix)]\nfn example() {}\n");
    await rename(source, path.join(dir, "src/renamed.rs"));
    await assert.rejects(readPlatformEntities(root), /sourceHash mismatch/);
    await rm(path.join(dir, "src/renamed.rs"));
    await assert.rejects(readPlatformEntities(root), /sourceHash mismatch/);
    await writeFile(
      registry,
      JSON.stringify({ ...manifest, sourceHash: null })
    );
    await assert.rejects(readPlatformEntities(root), /sourceHash is pending/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("project check rejects ignored Cargo source drift on cold and cached snapshots", async () => {
  const { createHash } = await import("node:crypto");
  const { cargoSourceFingerprint } = await import("./platform-entities.ts");
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
      const sourceHash = await cargoSourceFingerprint(
        path.join(root, "tools/record-cli")
      );
      const id = `test:${createHash("sha256")
        .update(
          JSON.stringify(["cargo", "record-cli", "test\0example", "foreign"])
        )
        .digest("hex")}`;
      const registry = path.join(
        root,
        "scripts/test-evidence/platform-entities.json"
      );
      await fs.mkdir(path.dirname(registry), { recursive: true });
      await fs.writeFile(
        registry,
        JSON.stringify({
          version: 1,
          sourceHash,
          entities: [
            {
              id,
              platform: process.platform === "win32" ? "unix" : "windows",
              locator: "cargo:test:example > foreign"
            }
          ]
        })
      );
      const snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root
      });
      const cases = path.join(root, "docs/test-evidence/cases");
      await fs.mkdir(cases, { recursive: true });
      await fs.writeFile(
        path.join(cases, "fixture.md"),
        `### Case PROJECT-CARGO-DRIFT-001: ignored source\n\nTests:\n- \`${snapshot.entities[0]!.id}\`\n\nContract:\n- Cargo identity remains stable.\n\nProves:\n- Ignored source drift is rejected.\n`
      );
      assert.equal(
        (await syncTestEvidenceIndex({ mode: "write", workspaceRoot: root }))
          .status,
        "ok"
      );
      const runWithDrift = async () => {
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
          assert.equal(
            result.diagnostics[0]?.code,
            "project.cargo-source-drift"
          );
        } finally {
          Object.defineProperty(fs, "readFile", descriptor);
        }
      };
      await runWithDrift();
      await fs.writeFile(ignored, original);
      assert.equal((await checkRepositoryTestEvidence(root)).status, "ok");
      const cache = path.join(
        root,
        ".log/vibe-check/cache/test-evidence-snapshots-v1"
      );
      assert.equal((await fs.readdir(cache)).length, 1);
      await runWithDrift();
    }
  );
});
