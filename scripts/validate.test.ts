import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateRepository } from "./validate.ts";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const skillMarkdown = `---
name: sample-skill
description: Healthy validation fixture
metadata:
  version: "1"
---

# Sample Skill
`;

async function withHealthyRepository(
  run: (root: string, skillPath: string) => Promise<void>
) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills repository validation ")
  );
  try {
    for (const relative of [
      "README.md",
      "AGENTS.md",
      "pnpm-workspace.yaml",
      "tsconfig.json",
      "scripts/environment.js",
      "scripts/auto-push.ts",
      "scripts/setup-git-hooks.js",
      "scripts/setup-repository.js",
      "scripts/task-graph.js",
      "scripts/lint.ts",
      "scripts/vibe-check.ts",
      "scripts/vibe-check.test.ts",
      "scripts/lib/vibe-gate.ts",
      "docs/tooling.md",
      ".githooks/pre-commit",
      ".githooks/post-commit",
      ".github/workflows/package-skills.yml"
    ]) {
      const target = path.join(root, relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, "");
    }
    await fs.mkdir(path.join(root, "docs/skills"), { recursive: true });
    for (const relative of [
      "package.json",
      ".oxfmtrc.json",
      ".oxlintrc.json"
    ]) {
      await fs.copyFile(
        path.join(repositoryRoot, relative),
        path.join(root, relative)
      );
    }
    const skillPath = path.join(root, "skills/sample-skill/SKILL.md");
    await fs.mkdir(path.dirname(skillPath), { recursive: true });
    await fs.writeFile(skillPath, skillMarkdown);
    assert.deepEqual((await validateRepository(root)).errors, []);
    await run(root, skillPath);
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
}

test("repository validation skips missing skill links in an otherwise healthy repository", async () => {
  await withHealthyRepository(async (root, skillPath) => {
    await fs.appendFile(skillPath, "\n[Missing](references/missing.md)\n");
    const result = await validateRepository(root);
    assert.equal(result.skillCount, 1);
    assert.deepEqual(result.errors, []);
  });
});

test("repository validation preserves skill structure failures independently of link checks", async () => {
  await withHealthyRepository(async (root, skillPath) => {
    await fs.writeFile(
      skillPath,
      skillMarkdown.replace("Healthy validation fixture", "''")
    );
    const result = await validateRepository(root);
    assert.equal(result.skillCount, 1);
    assert.deepEqual(result.errors, [
      "skills/sample-skill/SKILL.md frontmatter description must be a non-empty string"
    ]);
  });
});
