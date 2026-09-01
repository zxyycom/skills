import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateRepository } from "./validate.ts";

test("repository validation skips skill links while preserving skill structure failures", async () => {
  const workspaceRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills repository validation ")
  );
  try {
    const skillDirectory = path.join(workspaceRoot, "skills", "broken-skill");
    await fs.mkdir(skillDirectory, { recursive: true });
    await fs.writeFile(
      path.join(skillDirectory, "SKILL.md"),
      [
        "---",
        "name: broken-skill",
        "description: ''",
        "---",
        "",
        "# Broken Skill",
        "",
        "[Missing](references/missing.md)",
        ""
      ].join("\n"),
      "utf8"
    );

    const result = await validateRepository(workspaceRoot);

    assert.ok(
      result.errors.includes(
        "skills/broken-skill/SKILL.md frontmatter description must be a non-empty string"
      )
    );
    assert.equal(
      result.errors.some((error) => error.includes("missing link target")),
      false
    );
  } finally {
    await fs.rm(workspaceRoot, { force: true, recursive: true });
  }
});
