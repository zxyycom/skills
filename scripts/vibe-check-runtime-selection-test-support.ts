import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot } from "./vibe-check-test-support.ts";

export async function writeRuntimeFixtureFile(
  directory: string,
  relative: string,
  content: string
): Promise<void> {
  const file = path.join(directory, relative);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content);
}

export async function createRuntimeSelectionFixture(
  directory: string
): Promise<void> {
  // Copy only the real CLI's execution modules, not an alternate generator.
  const modules = [
    "scripts/build/skill-updaters.ts",
    "scripts/lib/skill-runtime.ts",
    "scripts/lib/skill-runtime-selection.ts",
    "scripts/lib/source-runtime.ts",
    "scripts/lib/source-runtime-facts.ts",
    "scripts/lib/source-runtime-sync.ts",
    "scripts/lib/generated-file.ts",
    "scripts/lib/generated-file-header.ts",
    "scripts/lib/generated-typescript-declarations.ts",
    "scripts/lib/source-map.ts",
    "scripts/lib/project.ts",
    "tools/shared/src/node/main-module.ts",
    "tools/shared/src/node/filesystem.ts",
    "tools/skill-package/src/release-manifest.ts"
  ];
  for (const file of modules)
    await writeRuntimeFixtureFile(
      directory,
      file,
      await fs.readFile(path.join(repositoryRoot, file), "utf8")
    );
  await fs.symlink(
    path.join(repositoryRoot, "node_modules"),
    path.join(directory, "node_modules"),
    process.platform === "win32" ? "junction" : "dir"
  );
  await writeRuntimeFixtureFile(
    directory,
    "package.json",
    JSON.stringify({
      type: "module",
      packageManager: "pnpm@11.7.0",
      scripts: {
        "check:skill-updaters": "bun scripts/build/skill-updaters.ts --check"
      },
      devDependencies: { "@types/node": "26.0.1" }
    })
  );
  await writeRuntimeFixtureFile(
    directory,
    "tools/skill-updater/src/index.ts",
    [
      'import path from "node:path";',
      'import { value } from "../../shared/src/value.ts";',
      'export type { UpdaterConfig } from "./types.ts";',
      "export function runSkillUpdaterCli() { return path.basename(value); }",
      ""
    ].join("\n")
  );
  await writeRuntimeFixtureFile(
    directory,
    "tools/skill-updater/src/types.ts",
    "export type UpdaterConfig = Readonly<Record<string, string>>;\n"
  );
  await writeRuntimeFixtureFile(
    directory,
    "tools/shared/src/value.ts",
    'export const value = "healthy";\n'
  );
  for (const name of ["ai-ready-docs", "file-lifecycle-hygiene"]) {
    await writeRuntimeFixtureFile(
      directory,
      `skills/${name}/SKILL.md`,
      `# ${name}\n`
    );
    await writeRuntimeFixtureFile(
      directory,
      `skills/${name}/pnpm-lock.yaml`,
      [
        'lockfileVersion: "9.0"',
        "importers:",
        '  ".":',
        "    dependencies:",
        "      '@types/node':",
        "        specifier: 26.0.1",
        ""
      ].join("\n")
    );
  }
  const initialized = runtimeFixtureCli(directory, ["--write"]);
  assert.equal(initialized.status, 0, initialized.stderr);
  const healthy = runtimeFixtureCli(directory, ["--check"]);
  assert.equal(healthy.status, 0, healthy.stderr);
}

export function runtimeFixtureCli(
  directory: string,
  args: readonly string[],
  packageScript = false
) {
  return spawnSync(
    "bun",
    packageScript
      ? ["run", "check:skill-updaters", ...args]
      : ["scripts/build/skill-updaters.ts", ...args],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 30_000,
      windowsHide: true
    }
  );
}

export async function runtimeFixtureBytes(
  directory: string
): Promise<readonly (readonly string[])[]> {
  const entries = await fs.readdir(directory, {
    recursive: true,
    withFileTypes: true
  });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
  return await Promise.all(
    files.map(async (file) => [
      path.relative(directory, file),
      createHash("sha256")
        .update(await fs.readFile(file))
        .digest("hex")
    ])
  );
}

// Fresh process interception observes Node reads and ast-grep scan targets without
// replacing their behavior for healthy inputs or mutating shared test globals.
export function probeRuntimeSourceEscape(
  directory: string,
  afterFacts: boolean
) {
  const script = `
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { promisify } from "node:util";
const [moduleUrl, workspaceRoot, afterFacts] = process.argv.slice(1);
const reads = [];
const scans = [];
async function outside(file) {
  const relative = path.relative(workspaceRoot, await fs.realpath(file));
  return relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative);
}
const readFile = fs.readFile.bind(fs);
fs.readFile = async (file, ...args) => {
  if (typeof file === "string" && await outside(file)) {
    reads.push(file);
    throw new Error("external source bytes were requested");
  }
  return await readFile(file, ...args);
};
const execFile = childProcess.execFile;
const execute = promisify(execFile);
function observedExecFile(...args) { return execFile(...args); }
observedExecFile[promisify.custom] = async (command, args, options) => {
  for (const argument of args) {
    if (argument.endsWith(".ts") && await outside(path.resolve(options.cwd, argument))) {
      scans.push(argument);
      throw new Error("external source scan was requested");
    }
  }
  return await execute(command, args, options);
};
childProcess.execFile = observedExecFile;
syncBuiltinESMExports();
const runtime = await import(moduleUrl);
let diagnostic = null;
let artifactsReturned = false;
try {
  const facts = await runtime.captureSourceRuntimeFacts(workspaceRoot, ["tools/alpha/src/index.ts"]);
  if (afterFacts === "true") {
    await fs.rename(path.join(workspaceRoot, "tools/linked"), path.join(workspaceRoot, "tools/previous-linked"));
    await fs.symlink(path.join(workspaceRoot, "../outside"), path.join(workspaceRoot, "tools/linked"), process.platform === "win32" ? "junction" : "dir");
  }
  await runtime.buildSourceRuntimeArtifacts({
    workspaceRoot, skillName: "alpha", nodeEngine: ">=24.18", rebuildCommand: "fixture-only",
    entries: [{sourcePath: "tools/alpha/src/index.ts", outputName: "cli.ts", body: "export {};"}]
  }, facts);
  artifactsReturned = true;
} catch (error) { diagnostic = error.message; }
assert.equal(artifactsReturned, false);
assert.match(diagnostic ?? "", /Runtime source escapes trusted tools/);
assert.deepEqual(reads, []);
assert.deepEqual(scans, []);
await assert.rejects(fs.access(path.join(workspaceRoot, "skills")), { code: "ENOENT" });
console.log(JSON.stringify({ diagnostic, reads, scans, artifactsReturned }));
`;
  return spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      script,
      pathToFileURL(path.join(repositoryRoot, "scripts/lib/source-runtime.ts"))
        .href,
      directory,
      String(afterFacts)
    ],
    { encoding: "utf8", timeout: 30_000, windowsHide: true }
  );
}
