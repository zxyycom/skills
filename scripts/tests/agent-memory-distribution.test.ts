import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

function success(stdout: string): Record<string, unknown> {
  const output: unknown = JSON.parse(stdout);
  assert.ok(
    output !== null && typeof output === "object" && !Array.isArray(output)
  );
  return { ...output };
}

test("distributed Node CLI initializes and recalls an isolated memory", () => {
  const temp = mkdtempSync(path.join(tmpdir(), "agent-memory-distribution-"));
  try {
    const source = fileURLToPath(
      new URL("../../skills/agent-memory/", import.meta.url)
    );
    const installed = path.join(temp, "installed-skill");
    mkdirSync(installed);
    copyFileSync(
      path.join(source, "package.json"),
      path.join(installed, "package.json")
    );
    cpSync(path.join(source, "scripts"), path.join(installed, "scripts"), {
      recursive: true
    });
    const modules = path.join(installed, "node_modules");
    mkdirSync(modules);
    // Supply the CLI's declared parser from the prepared host; do not expose repository source or install dependencies.
    const valibot = realpathSync(
      fileURLToPath(new URL("../../node_modules/valibot/", import.meta.url))
    );
    cpSync(valibot, path.join(modules, "valibot"), { recursive: true });
    const root = path.join(temp, "project");
    mkdirSync(root);
    const db = path.join(temp, "memory.sqlite");
    const cli = path.join(installed, "scripts", "agent-memory.ts");
    function call(
      command: string,
      input: Readonly<Record<string, unknown>>,
      database = db
    ) {
      const child = spawnSync(
        process.execPath,
        [cli, command, "--root", root, "--db", database, "--json"],
        {
          cwd: root,
          input: JSON.stringify(input),
          encoding: "utf8",
          timeout: 10_000,
          windowsHide: true
        }
      );
      assert.ifError(child.error);
      assert.equal(child.signal, null);
      return child;
    }
    function run(command: string, input: Record<string, unknown>) {
      const { status, stdout, stderr } = call(command, input);
      assert.equal(status, 0, stderr);
      assert.equal(stderr, "");
      return success(stdout);
    }
    const missing = call("recall", { terms: ["中文"] });
    assert.equal(missing.status, 1);
    assert.equal(missing.stdout, "");
    assert.match(missing.stderr, /cannot open bound database/u);
    run("init", {});
    const saved = run("save", {
      requestId: "one",
      kind: "knowledge",
      title: "分发验证",
      body: "中文正文",
      source: "隔离样例",
      conditions: "测试"
    });
    assert.ok(typeof saved.id === "string" && saved.id.length > 0);
    const found = run("recall", { terms: ["中文"] });
    assert.ok(Array.isArray(found.items));
    const items: unknown[] = found.items;
    assert.equal(items.length, 1);
    const item = items[0];
    assert.ok(item !== null && typeof item === "object" && "id" in item);
    assert.equal(item.id, saved.id);
    rmSync(
      path.join(
        installed,
        "scripts",
        "runtime",
        "tools",
        "agent-memory",
        "src",
        "schema.sql"
      )
    );
    const secondDb = path.join(temp, "other.sqlite");
    const broken = call("init", {}, secondDb);
    assert.equal(broken.status, 1);
    assert.equal(broken.stdout, "");
    assert.match(broken.stderr, /cannot read schema\.sql/u);
    assert.equal(existsSync(secondDb), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
