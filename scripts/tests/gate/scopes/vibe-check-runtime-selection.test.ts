import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import * as v from "valibot";
import { createGateDefinition } from "../../../lib/vibe-gate.ts";
import {
  discoverSelectedSkillPackages,
  parseSkillUpdaterArguments
} from "../../../lib/generation/runtime/skill-runtime-selection.ts";
import {
  buildSourceRuntimeArtifacts,
  captureSourceRuntimeFacts
} from "../../../lib/generation/runtime/source-runtime.ts";
import { resolveSelectedRuntimeSkills } from "../../../lib/vibe-gate/runtime-prerequisites.ts";
import { withTemporaryDirectory } from "../vibe-check-test-support.ts";
import {
  createRuntimeSelectionFixture,
  probeRuntimeSourceEscape,
  runtimeFixtureBytes,
  runtimeFixtureCli,
  writeRuntimeFixtureFile
} from "./vibe-check-runtime-selection-test-support.ts";

test("selected generated prerequisites union consumer skills without unrelated domains", () => {
  assert.deepEqual(resolveSelectedRuntimeSkills(["gate-tests"]), []);
  assert.deepEqual(resolveSelectedRuntimeSkills(["mcpshell"]), [
    "mcpshell-workspace-tools"
  ]);
  assert.deepEqual(resolveSelectedRuntimeSkills(["test-evidence"]), [
    "test-evidence-review"
  ]);
  assert.deepEqual(resolveSelectedRuntimeSkills(["skill-validator"]), [
    "skill-maintainer"
  ]);
  assert.deepEqual(resolveSelectedRuntimeSkills(["skill-updater"]), [
    "ai-ready-docs"
  ]);
  assert.deepEqual(
    resolveSelectedRuntimeSkills(["record-reader-distribution"]),
    ["decision-records", "investigation-report"]
  );
  assert.deepEqual(
    resolveSelectedRuntimeSkills(["mcpshell", "test-evidence", "mcpshell"]),
    ["mcpshell-workspace-tools", "test-evidence-review"]
  );
  assert.equal(
    resolveSelectedRuntimeSkills(["generated-artifacts", "mcpshell"]),
    undefined
  );
});

test("selected Definition passes only required consumer skills to the generation provider command", () => {
  const commandSchema = v.looseObject({
    executable: v.string(),
    arguments: v.array(v.string())
  });
  for (const scenario of [
    {
      scope: "selected",
      selectionScopes: ["mcpshell"],
      expected: ["mcpshell-workspace-tools"]
    },
    {
      scope: "selected",
      selectionScopes: ["mcpshell", "test-evidence"],
      expected: ["mcpshell-workspace-tools", "test-evidence-review"]
    },
    {
      scope: "selected",
      selectionScopes: ["record-reader-distribution"],
      expected: ["decision-records", "investigation-report"]
    },
    {
      scope: "selected",
      selectionScopes: ["generated-artifacts"],
      expected: []
    },
    { scope: "changed", selectionScopes: undefined, expected: [] },
    { scope: "full", selectionScopes: undefined, expected: [] }
  ] as const) {
    const definition = createGateDefinition([], {
      scope: scenario.scope,
      ...(scenario.selectionScopes === undefined
        ? {}
        : { selectionScopes: scenario.selectionScopes })
    });
    const provider = definition.checks.find(
      ({ checkId }) => checkId === "script:check:skill-updaters"
    );
    assert.ok(provider);
    const command = v.parse(commandSchema, provider.options);
    assert.equal(command.executable, "bun");
    assert.deepEqual(command.arguments, [
      "run",
      "check:skill-updaters",
      ...scenario.expected.flatMap((name) => ["--skill", name])
    ]);
  }
});

test("updater scope arguments preserve full defaults and reject invalid write selections", () => {
  assert.deepEqual(parseSkillUpdaterArguments([]), { mode: "check" });
  assert.deepEqual(parseSkillUpdaterArguments(["--write"]), { mode: "write" });
  assert.deepEqual(
    parseSkillUpdaterArguments([
      "--check",
      "--skill",
      "ai-ready-docs",
      "--skill",
      "file-lifecycle-hygiene",
      "--skill",
      "ai-ready-docs"
    ]),
    { mode: "check", skillNames: ["ai-ready-docs", "file-lifecycle-hygiene"] }
  );
  for (const args of [
    ["--skill"],
    ["--skill", ""],
    ["--skill", "../ai-ready-docs"],
    ["--skill", "AI-Ready-Docs"],
    ["--skill", "ai-ready-docs", "--write"],
    ["--check", "--write"],
    ["--unknown"]
  ])
    assert.throws(() => parseSkillUpdaterArguments(args), args.join(" "));
});

test("selected skill discovery ignores unrelated broken packages but rejects invalid selected identities", async () => {
  await withTemporaryDirectory(
    "runtime-selected-discovery-",
    async (directory) => {
      await writeRuntimeFixtureFile(
        directory,
        "skills/alpha/SKILL.md",
        "# alpha\n"
      );
      await fs.mkdir(path.join(directory, "skills/broken"));
      const selected = await discoverSelectedSkillPackages(
        ["alpha", "alpha"],
        directory
      );
      assert.deepEqual(selected, [
        { name: "alpha", directory: path.join(directory, "skills/alpha") }
      ]);
      for (const names of [
        [],
        ["alpha", "missing"],
        ["broken"],
        ["../alpha"],
        [""]
      ])
        await assert.rejects(discoverSelectedSkillPackages(names, directory));
      await fs.symlink(
        path.join(directory, "skills/alpha"),
        path.join(directory, "skills/linked"),
        process.platform === "win32" ? "junction" : "dir"
      );
      await assert.rejects(
        discoverSelectedSkillPackages(["linked"], directory),
        /regular directory/u
      );
      await fs.rename(
        path.join(directory, "skills/alpha/SKILL.md"),
        path.join(directory, "skill-target.md")
      );
      await fs.symlink(
        path.join(directory, "skill-target.md"),
        path.join(directory, "skills/alpha/SKILL.md")
      );
      await assert.rejects(
        discoverSelectedSkillPackages(["alpha"], directory),
        /regular file/u
      );
    }
  );
});

test("selected runtime source acquisition follows shared cycles but never scans unrelated invalid imports", async () => {
  await withTemporaryDirectory(
    "runtime-selected-closure-",
    async (directory) => {
      await writeRuntimeFixtureFile(
        directory,
        "package.json",
        JSON.stringify({ packageManager: "pnpm@11.7.0", devDependencies: {} })
      );
      await writeRuntimeFixtureFile(
        directory,
        "tools/alpha/src/index.ts",
        'export { value } from "../../shared/src/leaf.js";\n'
      );
      await writeRuntimeFixtureFile(
        directory,
        "tools/shared/src/leaf.ts",
        'import "../../alpha/src/index.ts";\nexport const value = 1;\n'
      );
      await writeRuntimeFixtureFile(
        directory,
        "tools/unrelated/src/invalid.ts",
        'import "./bad\\x2dname.ts";\n'
      );
      const facts = await captureSourceRuntimeFacts(directory, [
        "tools/alpha/src/index.ts"
      ]);
      assert.deepEqual(
        [...facts.references.keys()]
          .map((file) => path.relative(directory, file))
          .sort(),
        ["tools/alpha/src/index.ts", "tools/shared/src/leaf.ts"]
      );
      await writeRuntimeFixtureFile(
        directory,
        "tools/unrelated/src/index.ts",
        "export const unrelated = true;\n"
      );
      await assert.rejects(
        buildSourceRuntimeArtifacts(
          {
            workspaceRoot: directory,
            skillName: "unrelated",
            nodeEngine: ">=24.18",
            rebuildCommand: "fixture-only",
            entries: [
              {
                sourcePath: "tools/unrelated/src/index.ts",
                outputName: "cli.ts",
                body: "export {};"
              }
            ]
          },
          facts
        ),
        /Source runtime facts do not cover/u
      );
      await assert.rejects(
        captureSourceRuntimeFacts(directory),
        /Unsupported escaped module specifier/u
      );
      await writeRuntimeFixtureFile(
        directory,
        "tools/shared/src/leaf.ts",
        'import "./bad\\x2dname.ts";\n'
      );
      await assert.rejects(
        captureSourceRuntimeFacts(directory, ["tools/alpha/src/index.ts"]),
        /Unsupported escaped module specifier.*leaf.ts/u
      );
      await writeRuntimeFixtureFile(
        directory,
        "tools/shared/src/leaf.ts",
        'import "./missing.ts";\n'
      );
      await assert.rejects(
        captureSourceRuntimeFacts(directory, ["tools/alpha/src/index.ts"]),
        /ENOENT.*missing.ts/u
      );
    }
  );
});

test("updater CLI isolates selected generated checks while preserving selected and shared drift failures", async () => {
  await withTemporaryDirectory("runtime-selected-cli-", async (directory) => {
    await createRuntimeSelectionFixture(directory);
    const args = ["--skill", "ai-ready-docs"];
    const selectedArtifact =
      "skills/ai-ready-docs/scripts/runtime/tools/shared/src/value.ts";
    const unrelatedArtifact =
      "skills/file-lifecycle-hygiene/scripts/runtime/tools/shared/src/value.ts";
    const union = runtimeFixtureCli(
      directory,
      [...args, "--skill", "file-lifecycle-hygiene"],
      true
    );
    assert.equal(union.status, 0, union.stderr);
    await writeRuntimeFixtureFile(
      directory,
      unrelatedArtifact,
      "unrelated generated drift\n"
    );
    await fs.unlink(
      path.join(directory, "skills/file-lifecycle-hygiene/SKILL.md")
    );
    await writeRuntimeFixtureFile(
      directory,
      "tools/unrelated/src/invalid.ts",
      'import "./bad\\x2dname.ts";\n'
    );
    const before = await runtimeFixtureBytes(directory);
    const passed = runtimeFixtureCli(directory, [...args, ...args], true);
    assert.equal(passed.status, 0, passed.stderr);
    assert.equal(passed.stdout, "");
    assert.deepEqual(await runtimeFixtureBytes(directory), before);
    const complete = runtimeFixtureCli(directory, ["--check"]);
    assert.equal(complete.status, 1);
    assert.match(complete.stderr, /file-lifecycle-hygiene.*SKILL.md/u);
    const healthyArtifact = await fs.readFile(
      path.join(directory, selectedArtifact),
      "utf8"
    );
    await writeRuntimeFixtureFile(
      directory,
      selectedArtifact,
      "selected generated drift\n"
    );
    const driftedBytes = await runtimeFixtureBytes(directory);
    const drifted = runtimeFixtureCli(directory, args, true);
    assert.equal(drifted.status, 1);
    assert.ok(drifted.stderr.includes(selectedArtifact));
    assert.deepEqual(await runtimeFixtureBytes(directory), driftedBytes);
    await writeRuntimeFixtureFile(directory, selectedArtifact, healthyArtifact);
    await writeRuntimeFixtureFile(
      directory,
      "tools/shared/src/value.ts",
      'export const value = "shared source changed";\n'
    );
    const sharedBytes = await runtimeFixtureBytes(directory);
    const shared = runtimeFixtureCli(directory, args, true);
    assert.equal(shared.status, 1);
    assert.ok(shared.stderr.includes(selectedArtifact));
    assert.deepEqual(await runtimeFixtureBytes(directory), sharedBytes);
  });
});

test("updater CLI validates the complete selected set before any writes", async () => {
  await withTemporaryDirectory(
    "runtime-selected-rejected-cli-",
    async (directory) => {
      await createRuntimeSelectionFixture(directory);
      await writeRuntimeFixtureFile(
        directory,
        "skills/skill-maintainer/SKILL.md",
        "# skill-maintainer\n"
      );
      await writeRuntimeFixtureFile(
        directory,
        "scripts/build/skill-validator.ts",
        'throw new Error("adapter loaded before selection validation");\n'
      );
      const before = await runtimeFixtureBytes(directory);
      for (const { args, diagnostic } of [
        { args: ["--check", "--skill"], diagnostic: /argument missing/u },
        {
          args: ["--check", "--skill", ""],
          diagnostic: /Invalid selected skill name/u
        },
        {
          args: ["--check", "--skill", "../ai-ready-docs"],
          diagnostic: /Invalid selected skill name/u
        },
        {
          args: ["--check", "--skill", "ai-ready-docs", "--skill", "missing"],
          diagnostic: /Unknown or invalid selected skill "missing"/u
        },
        {
          args: [
            "--check",
            "--skill",
            "skill-maintainer",
            "--skill",
            "missing"
          ],
          diagnostic: /Unknown or invalid selected skill "missing"/u
        },
        {
          args: ["--write", "--skill", "ai-ready-docs"],
          diagnostic: /--skill is only supported in check mode/u
        }
      ]) {
        const rejected = runtimeFixtureCli(directory, args);
        assert.equal(rejected.status, 1, rejected.stderr);
        assert.equal(rejected.stdout, "");
        assert.match(rejected.stderr, diagnostic);
        assert.deepEqual(await runtimeFixtureBytes(directory), before);
      }
    }
  );
});

test("runtime source boundaries reject parent symlink escapes before external scans reads or generation", async () => {
  await withTemporaryDirectory("runtime-parent-escape-", async (directory) => {
    await writeRuntimeFixtureFile(
      directory,
      "outside/value.ts",
      'export const value = "outside sentinel";\n'
    );
    for (const afterFacts of [false, true]) {
      const workspace = path.join(directory, String(afterFacts));
      await writeRuntimeFixtureFile(
        workspace,
        "package.json",
        JSON.stringify({ packageManager: "pnpm@11.7.0", devDependencies: {} })
      );
      await writeRuntimeFixtureFile(
        workspace,
        "tools/alpha/src/index.ts",
        'export { value } from "../../linked/value.ts";\n'
      );
      if (afterFacts)
        await writeRuntimeFixtureFile(
          workspace,
          "tools/linked/value.ts",
          "export const value = 1;\n"
        );
      else
        await fs.symlink(
          path.join(directory, "outside"),
          path.join(workspace, "tools/linked"),
          process.platform === "win32" ? "junction" : "dir"
        );
      const rejected = probeRuntimeSourceEscape(workspace, afterFacts);
      assert.equal(rejected.status, 0, rejected.stderr || rejected.stdout);
      const observation = v.parse(
        v.object({
          diagnostic: v.string(),
          reads: v.array(v.string()),
          scans: v.array(v.string()),
          artifactsReturned: v.boolean()
        }),
        JSON.parse(rejected.stdout) as unknown
      );
      assert.match(
        observation.diagnostic,
        /Runtime source escapes trusted tools/u
      );
      assert.deepEqual(observation.reads, []);
      assert.deepEqual(observation.scans, []);
      assert.equal(observation.artifactsReturned, false);
      await assert.rejects(fs.access(path.join(workspace, "skills")), {
        code: "ENOENT"
      });
    }
    assert.equal(
      await fs.readFile(path.join(directory, "outside/value.ts"), "utf8"),
      'export const value = "outside sentinel";\n'
    );
  });
});
