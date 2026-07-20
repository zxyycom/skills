import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runSkillValidatorCli,
  validateSkillDirectory as validateBundledSkillDirectory
} from "../../../skills/skill-maintainer/scripts/validate-skill.mjs";
import { validateSkillDirectory } from "../src/validation.ts";

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testsDirectory, "../../..");
const generatedValidatorPath = path.join(
  rootDir,
  "skills",
  "skill-maintainer",
  "scripts",
  "validate-skill.mjs"
);
const generatedDeclarationPath = path.join(
  rootDir,
  "skills",
  "skill-maintainer",
  "scripts",
  "validate-skill.d.mts"
);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skill-validator-test-"));
try {
  const validSkillPath = path.join(tempRoot, "valid-skill");
  await fs.mkdir(path.join(validSkillPath, "references"), { recursive: true });
  await fs.writeFile(
    path.join(validSkillPath, "SKILL.md"),
    [
      "---",
      "name: valid-skill",
      "description: Use when validating a portable skill structure.",
      "---",
      "",
      "# Valid Skill",
      "",
      "Read the [guide](references/guide.md#details).",
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(
    path.join(validSkillPath, "references", "guide.md"),
    "# Guide\n\n## Details\n\nCurrent guidance.\n",
    "utf8"
  );

  const valid = await validateSkillDirectory(validSkillPath);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.markdownFileCount, 2);
  assert.deepEqual(await validateBundledSkillDirectory(validSkillPath), valid);
  assert.equal(typeof runSkillValidatorCli, "function");

  const cliSuccess = spawnSync("node", [generatedValidatorPath, validSkillPath], {
    encoding: "utf8"
  });
  assert.equal(cliSuccess.status, 0, cliSuccess.stderr);
  assert.match(cliSuccess.stdout, /Skill structure validation passed/);
  assert.match(cliSuccess.stdout, /2 markdown files checked/);

  const invalidSkillPath = path.join(tempRoot, "invalid-skill");
  await fs.mkdir(invalidSkillPath);
  await fs.writeFile(
    path.join(invalidSkillPath, "SKILL.md"),
    [
      "---",
      "name: Wrong_Name",
      "description: ''",
      "---",
      "",
      "[Missing](references/missing.md)",
      "[Outside](../outside.md)",
      ""
    ].join("\n"),
    "utf8"
  );
  await fs.writeFile(path.join(invalidSkillPath, "scripts"), "not a directory\n", "utf8");
  await fs.writeFile(path.join(tempRoot, "outside.md"), "# Outside\n", "utf8");

  const invalid = await validateSkillDirectory(invalidSkillPath);
  assert.ok(invalid.errors.some((error) => error.includes("name must use kebab-case")));
  assert.ok(invalid.errors.some((error) => error.includes("name must match directory name")));
  assert.ok(invalid.errors.some((error) => error.includes("description must be a non-empty string")));
  assert.ok(invalid.errors.some((error) => error.includes("scripts/ must be a directory")));
  assert.ok(invalid.errors.some((error) => error.includes("missing link target")));
  assert.ok(invalid.errors.some((error) => error.includes("links outside")));

  const cliFailure = spawnSync("node", [generatedValidatorPath, invalidSkillPath], {
    encoding: "utf8"
  });
  assert.equal(cliFailure.status, 1);
  assert.match(cliFailure.stderr, /Skill structure validation failed/);
  assert.match(cliFailure.stderr, /frontmatter name must use kebab-case/);

  const missingSkillPath = path.join(tempRoot, "missing-skill");
  await fs.mkdir(missingSkillPath);
  assert.ok((await validateSkillDirectory(missingSkillPath)).errors.includes("SKILL.md is required"));

  const emptyBodyPath = path.join(tempRoot, "empty-body");
  await fs.mkdir(emptyBodyPath);
  await fs.writeFile(
    path.join(emptyBodyPath, "SKILL.md"),
    "---\nname: empty-body\ndescription: Use when testing an empty body.\n---\n",
    "utf8"
  );
  assert.ok(
    (await validateSkillDirectory(emptyBodyPath)).errors.includes(
      "SKILL.md body must contain executable guidance"
    )
  );

  const malformedFrontmatterPath = path.join(tempRoot, "malformed-frontmatter");
  await fs.mkdir(malformedFrontmatterPath);
  await fs.writeFile(
    path.join(malformedFrontmatterPath, "SKILL.md"),
    "---\nname: [invalid\ndescription: Invalid YAML.\n---\n\n# Invalid\n",
    "utf8"
  );
  assert.ok(
    (await validateSkillDirectory(malformedFrontmatterPath)).errors.some(
      (error) => error.startsWith("SKILL.md frontmatter")
    )
  );

  const help = spawnSync("node", [generatedValidatorPath, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage: validate-skill\.mjs/);

  const extraArgument = spawnSync(
    "node",
    [generatedValidatorPath, validSkillPath, invalidSkillPath],
    { encoding: "utf8" }
  );
  assert.equal(extraArgument.status, 2);
  assert.match(extraArgument.stderr, /at most one skill-directory/);

  const validatorSource = await fs.readFile(generatedValidatorPath, "utf8");
  assert.match(validatorSource, /Repository: https:\/\/github\.com\/zxyycom\/skills/);
  assert.match(
    validatorSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/skill-validator\/src\/cli\.ts/
  );
  assert.match(validatorSource, /Rebuild: bun run sync:skill-validator/);
  assert.match(validatorSource, /sourceMappingURL=validate-skill\.mjs\.map/);
  const declarationSource = await fs.readFile(generatedDeclarationPath, "utf8");
  assert.match(
    declarationSource,
    /Maintained source: https:\/\/github\.com\/zxyycom\/skills\/blob\/main\/scripts\/skill-validator\/validate-skill\.d\.mts/
  );
  assert.match(declarationSource, /validateSkillDirectory/);
  assert.match(declarationSource, /runSkillValidatorCli/);

  const sourceMap = JSON.parse(await fs.readFile(`${generatedValidatorPath}.map`, "utf8")) as {
    sourceRoot: string;
    sources: string[];
  };
  assert.equal(sourceMap.sourceRoot, "../../../");
  assert.ok(sourceMap.sources.includes("scripts/skill-validator/src/cli.ts"));
  assert.ok(sourceMap.sources.every((source) => !path.isAbsolute(source) && !source.includes("\\")));
} finally {
  await fs.rm(tempRoot, { force: true, recursive: true });
}

console.log("Skill structure validator tests passed.");
