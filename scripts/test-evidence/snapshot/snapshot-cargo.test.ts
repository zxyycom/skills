import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { cargoArtifacts, cargoPackage } from "./snapshot-cargo-messages.ts";
import { cargoTestNames, collectCargoEntities } from "./snapshot-cargo.ts";
import { cargoTestCommand } from "./snapshot-commands.ts";
import { withSnapshotFixture } from "../test-fixture.ts";

test("Cargo native inventory distinguishes targets and includes ignored nodes", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "cargo evidence "));
  try {
    const dir = path.join(root, "tools/record-cli");
    await fs.mkdir(path.join(dir, "src"), { recursive: true });
    await fs.mkdir(path.join(dir, "tests"));
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { "test:record-rust": cargoTestCommand } })
    );
    await fs.writeFile(
      path.join(dir, "Cargo.toml"),
      '[package]\nname = "record-cli"\nversion = "0.1.0"\nedition = "2021"\n'
    );
    await fs.writeFile(
      path.join(dir, "Cargo.lock"),
      'version = 4\n\n[[package]]\nname = "record-cli"\nversion = "0.1.0"\n'
    );
    await fs.writeFile(
      path.join(dir, "src/lib.rs"),
      "#[test] fn same() {}\n#[test] #[ignore] fn ignored() {}\n"
    );
    await fs.writeFile(
      path.join(dir, "tests/sample.rs"),
      "#[test] fn same() {}\n"
    );
    const entities = await collectCargoEntities(root);
    assert.equal(entities.length, 3);
    assert.equal(new Set(entities.map((entry) => entry.id)).size, 3);
    assert.equal(entities.filter((entry) => entry.name === "same").length, 2);
    assert.ok(entities.some((entry) => entry.name === "ignored"));
    const selectors = entities.flatMap((entry) =>
      entry.locators.filter((locator) => locator.startsWith("cargo +"))
    );
    const base =
      "cargo +1.98.1 test --manifest-path ./tools/record-cli/Cargo.toml --locked";
    assert.deepEqual(
      selectors.sort(),
      [
        `${base} --lib -- "ignored" --exact --include-ignored`,
        `${base} --lib -- "same" --exact --include-ignored`,
        `${base} --test sample -- "same" --exact --include-ignored`
      ].sort()
    );
    for (const entity of entities) {
      assert.deepEqual(entity.locators, [...entity.locators].sort());
      assert.ok(
        entity.locators.some((locator) =>
          locator.endsWith(
            `-- ${JSON.stringify(entity.name)} --exact --include-ignored`
          )
        )
      );
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("Cargo inventory rejects malformed or duplicate native listing", () => {
  assert.throws(() => cargoTestNames("a: test\na: test\n"), /duplicate/);
  assert.throws(() => cargoTestNames("unexpected\n"), /unsupported/);
});

test("Cargo JSON rejects malformed metadata and artifact shapes", () => {
  assert.throws(
    () => cargoPackage('{"packages":{},"workspace_members":[]}'),
    /metadata shape/
  );
  const pkg = cargoPackage(
    JSON.stringify({
      packages: [
        { id: "p", targets: [{ name: "lib", kind: ["lib"], test: true }] }
      ],
      workspace_members: ["p"]
    })
  );
  assert.throws(
    () =>
      cargoPackage(
        JSON.stringify({ packages: [pkg], workspace_members: ["p", "missing"] })
      ),
    /exactly one workspace package/
  );
  assert.throws(
    () =>
      cargoArtifacts("", { ...pkg, targets: [...pkg.targets, ...pkg.targets] }),
    /duplicate Cargo metadata/
  );
  const message = {
    reason: "compiler-artifact",
    package_id: "p",
    executable: "/tmp/test",
    target: { name: "lib", kind: ["lib"] },
    profile: { test: true }
  };
  assert.equal(cargoArtifacts(JSON.stringify(message), pkg).size, 1);
  for (const invalid of [
    { ...message, profile: {} },
    { ...message, target: { name: "lib", kind: "lib" } },
    { ...message, executable: 1 }
  ])
    assert.throws(
      () => cargoArtifacts(JSON.stringify(invalid), pkg),
      /artifact shape/
    );
  assert.throws(
    () => cargoArtifacts(JSON.stringify({ reason: "build-finished" }), pkg),
    /do not match metadata/
  );
  assert.throws(
    () =>
      cargoArtifacts(
        [message, message].map((item) => JSON.stringify(item)).join("\n"),
        pkg
      ),
    /duplicate/
  );
});

test(
  "source fingerprint probes the pinned Rust toolchain despite an override",
  { skip: process.platform === "win32" },
  async () => {
    await withSnapshotFixture(
      { "test:record-rust": cargoTestCommand },
      { "tools/record-cli/Cargo.toml": "# fixture\n" },
      async (root) => {
        const bin = path.join(root, "fake-bin");
        const trace = path.join(root, "toolchain-arguments");
        await fs.mkdir(bin);
        for (const name of ["cargo", "rustc"]) {
          const file = path.join(bin, name);
          await fs.writeFile(
            file,
            `#!/bin/sh\nprintf '%s\\n' '${name}' "$@" >> "$TRACE"\nprintf 'fixture version\\n'\n`
          );
          await fs.chmod(file, 0o755);
        }
        const sourceModule = new URL("./snapshot-source.ts", import.meta.url)
          .href;
        execFileSync(
          process.execPath,
          [
            "-e",
            `import { sourceFingerprint } from ${JSON.stringify(sourceModule)}; await sourceFingerprint(${JSON.stringify(root)});`
          ],
          {
            env: {
              ...process.env,
              PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
              TRACE: trace,
              RUSTUP_TOOLCHAIN: "unexpected-override"
            }
          }
        );
        assert.deepEqual(
          (await fs.readFile(trace, "utf8")).trim().split("\n"),
          ["cargo", "+1.98.1", "--version", "rustc", "+1.98.1", "-Vv"]
        );
      }
    );
  }
);
