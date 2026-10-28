import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const relativePath = "tools/shared/src/version-control/git-command.ts";
const temp = await mkdtemp(join(tmpdir(), "git-input-lifecycle-"));
const previousPath = process.env.PATH;
const previousTrace = process.env.GIT_LIFECYCLE_PROBE_TRACE;

function executableSource(source) {
  const statement = 'import { simpleGit, type SimpleGit } from "simple-git";';
  assert.equal(source.split(statement).length, 2);
  source = source.replace(statement, "");
  const start = source.indexOf("export function createGitClient(");
  const end = source.indexOf("export function runGitForExitCode(", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(0, start) + source.slice(end);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

try {
  const baseline = execFileSync("git", ["show", `eea1d03e:${relativePath}`], {
    encoding: "utf8"
  });
  const current = await readFile(relativePath, "utf8");
  const digest = (text) => createHash("sha256").update(text).digest("hex");
  assert.equal(
    digest(baseline),
    "c995a8decc4b1237fe2c48db9e10aa5c4f6907bf5d140bdee05d5502dedaf0eb"
  );
  assert.equal(
    digest(current),
    "b92343438e68b76e7781a329efc8efc6b5de5282194b671cb803946ae0af1ce9"
  );
  for (const [name, text] of [
    ["baseline", baseline],
    ["current", current]
  ]) {
    await writeFile(join(temp, `${name}.ts`), executableSource(text));
  }
  const wrapper = `#!${process.execPath}
const fs = require("node:fs");
fs.writeFileSync(process.env.GIT_LIFECYCLE_PROBE_TRACE, String(process.pid));
process.on("SIGTERM", () => {});
fs.closeSync(0);
setTimeout(() => process.exit(1), 700);
`;
  await writeFile(join(temp, "git"), wrapper, { mode: 0o755 });
  process.env.PATH = temp;
  const results = {};
  for (const name of ["baseline", "current"]) {
    const trace = join(temp, `${name}.pid`);
    process.env.GIT_LIFECYCLE_PROBE_TRACE = trace;
    const module = await import(pathToFileURL(join(temp, `${name}.ts`)).href);
    await assert.rejects(
      module.runGitWithInputForExitCode(
        temp,
        ["hash-object", "-w", "--stdin"],
        Buffer.alloc(8 * 1024 * 1024)
      )
    );
    const pid = Number(await readFile(trace, "utf8"));
    results[name] = { aliveWhenRejected: alive(pid) };
    if (name === "baseline") {
      assert.equal(results[name].aliveWhenRejected, true);
      await new Promise((resolve) => setTimeout(resolve, 850));
      assert.equal(alive(pid), false);
    } else assert.equal(results[name].aliveWhenRejected, false);
  }
  console.log(JSON.stringify(results));
} finally {
  if (previousPath === undefined) delete process.env.PATH;
  else process.env.PATH = previousPath;
  if (previousTrace === undefined) delete process.env.GIT_LIFECYCLE_PROBE_TRACE;
  else process.env.GIT_LIFECYCLE_PROBE_TRACE = previousTrace;
  await rm(temp, { recursive: true, force: true });
}
