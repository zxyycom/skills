// Real binaries and a disposable private Git fixture; no production records are touched.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const directory = import.meta.dirname;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "record-cli-smoke-"));
const bins = process.env.RECORD_CLI_BIN_DIR
  ? path.resolve(process.env.RECORD_CLI_BIN_DIR)
  : path.resolve(directory, "../target/release");
const binary = (name: string) =>
  path.join(bins, name + (process.platform === "win32" ? ".exe" : ""));
function run(command: string, args: string[], expected = 0) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 1024 * 1024
  });
  if (result.error || result.status !== expected) {
    throw new Error(
      `${path.basename(command)} ${args.join(" ")}: status=${result.status} signal=${result.signal} error=${result.error || ""}\nstdout=${result.stdout}\nstderr=${result.stderr}`
    );
  }
  return result.stdout;
}
function assertObject(
  value: unknown,
  message: string
): asserts value is Record<string, unknown> {
  assert.ok(
    value !== null && typeof value === "object" && !Array.isArray(value),
    message
  );
}
function cli(name: string, args: string[], expected = 0) {
  const out = run(binary(name), [...args, "--root", root, "--json"], expected);
  let value: unknown;
  try {
    value = JSON.parse(out);
  } catch {
    throw new Error(`Invalid JSON from ${name}: ${out}`);
  }
  assertObject(value, `Invalid response from ${name}: ${out}`);
  assert.ok(
    "version" in value && "ok" in value,
    `Invalid response from ${name}: ${out}`
  );
  assert.equal(value.version, 2);
  assert.equal(value.ok, expected === 0, JSON.stringify(value));
  if (expected !== 0) {
    assert.ok(
      ("error" in value && value.error) ||
        ("diagnostics" in value &&
          Array.isArray(value.diagnostics) &&
          value.diagnostics.length),
      JSON.stringify(value)
    );
    return {};
  }
  assertObject(value.result, `Invalid result from ${name}: ${out}`);
  return value.result;
}
const git = (...args: string[]) => run("git", args);
try {
  for (const name of ["decision-records", "investigation-report"]) {
    assert.match(run(binary(name), ["--version"]), /0\.2\.1/);
    assert.match(run(binary(name), ["--help"]), /Usage:/);
  }
  const created = cli("decision-records", [
    "new",
    "sample",
    "--title",
    "Sample",
    "--purpose",
    "Purpose",
    "--background",
    "Background",
    "--decision",
    "Decision",
    "--tag",
    "test"
  ]);
  assert.ok("created" in created && "sourcePath" in created);
  assert.equal(created.created, true);
  assert.ok(typeof created.sourcePath === "string");
  assert.match(
    fs.readFileSync(
      path.join(root, "docs/decisions", created.sourcePath),
      "utf8"
    ),
    /Sample/
  );
  const candidate = cli("decision-records", ["show-candidate", "sample"]);
  assertObject(candidate.record, "Invalid candidate record");
  assert.ok(
    "decisionId" in candidate.record && "projection" in candidate.record
  );
  assert.ok(typeof candidate.record.decisionId === "string");
  assert.match(candidate.record.decisionId, /^\d{6}-sample$/);
  assert.equal(`${candidate.record.decisionId}.md`, created.sourcePath);
  assertObject(candidate.record.projection, "Invalid candidate projection");
  assert.ok("title" in candidate.record.projection);
  assert.equal(candidate.record.projection.title, "Sample");
  cli("decision-records", ["show", "missing"], 1);

  const report = cli("investigation-report", [
    "new",
    "old",
    "--title",
    "Title",
    "--question",
    "Question",
    "--tag",
    "test",
    "--formed-at",
    "2026-11-06T00:00:00Z"
  ]);
  assert.ok("id" in report);
  assert.equal(report.id, "261106-old");
  const resources = path.join(root, "docs/investigations/_resources");
  fs.mkdirSync(path.join(resources, "261106-old"), { recursive: true });
  fs.writeFileSync(
    path.join(resources, "261106-old/file.txt"),
    "private resource\n"
  );
  const renamed = cli("investigation-report", ["rename", "old", "new"]);
  assert.ok("committed" in renamed && "resourceOwnerMoved" in renamed);
  assert.equal(renamed.committed, true);
  assert.equal(renamed.resourceOwnerMoved, true);
  assert.equal(fs.existsSync(path.join(resources, "261106-old")), false);
  assert.equal(
    fs.readFileSync(path.join(resources, "261106-new/file.txt"), "utf8"),
    "private resource\n"
  );

  // An established record and index give stage a committed baseline.
  const decisions = path.join(root, "records");
  fs.mkdirSync(decisions);
  const fixture = path.join(
    directory,
    "../tests/fixtures/git-stage/documents/decision.md"
  );
  const original = fs.readFileSync(fixture, "utf8");
  fs.writeFileSync(path.join(decisions, "record.md"), original);
  cli("decision-records", ["sync-index", "--decisions-dir", "records"]);
  git("init", "-q");
  git("config", "core.autocrlf", "false");
  git("config", "commit.gpgsign", "false");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  fs.writeFileSync(path.join(root, "unselected.txt"), "baseline\n");
  git("add", "--", "records", "unselected.txt");
  git("commit", "-qm", "baseline");
  fs.writeFileSync(path.join(root, "unselected.txt"), "pending\n");
  git("add", "--", "unselected.txt");
  fs.writeFileSync(path.join(root, "unselected.txt"), "worktree\n");
  fs.writeFileSync(
    path.join(decisions, "record.md"),
    original.replace("Old title", "New title")
  );
  cli("decision-records", ["sync-index", "--decisions-dir", "records"]);
  const stage = cli("decision-records", [
    "stage",
    "record",
    "--decisions-dir",
    "records"
  ]);
  assert.ok("status" in stage);
  assert.equal(stage.status, "ok");
  assert.match(git("show", ":records/record.md"), /New title/);
  assert.equal(git("show", ":unselected.txt"), "pending\n");
  console.log("Native record CLI smoke passed (private fixture).");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
