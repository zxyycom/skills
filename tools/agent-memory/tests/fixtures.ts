import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { runCli } from "../src/cli.ts";

type Data = Record<string, unknown>;
type Response = { code: number; stdout: string; stderr: string };

function record(value: unknown): value is Data {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function fixture(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "agent-memory-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, "project");
  const other = join(dir, "other");
  const db = join(dir, "memory.sqlite");
  mkdirSync(root);
  mkdirSync(other);

  async function call(
    action: string,
    input: Data = {},
    target = root,
    database = db
  ): Promise<Response> {
    const out: string[] = [];
    const err: string[] = [];
    // Calls within this Node test file are serial; only capture writes during one CLI call.
    const stdout = t.mock.method(
      process.stdout,
      "write",
      (chunk: string | Uint8Array) => {
        out.push(chunk.toString());
        return true;
      }
    );
    const stderr = t.mock.method(
      process.stderr,
      "write",
      (chunk: string | Uint8Array) => {
        err.push(chunk.toString());
        return true;
      }
    );
    try {
      const code = await runCli([
        action,
        "--root",
        target,
        "--db",
        database,
        "--json",
        "--input",
        JSON.stringify(input)
      ]);
      return { code, stdout: out.join(""), stderr: err.join("") };
    } finally {
      stderr.mock.restore();
      stdout.mock.restore();
    }
  }

  success(await call("init"));
  async function ok(
    action: string,
    input?: Data,
    target?: string,
    database?: string
  ): Promise<Data> {
    return success(await call(action, input, target, database));
  }
  async function reject(
    action: string,
    input?: Data,
    target?: string,
    database?: string
  ): Promise<void> {
    refusal(await call(action, input, target, database));
  }
  async function save(input: Data): Promise<string> {
    return id(await ok("save", input));
  }
  return { ok, reject, save, dir, root, other, db };
}

function success(response: Response): Data {
  assert.equal(response.code, 0, response.stderr);
  assert.equal(response.stderr, "");
  const output: unknown = JSON.parse(response.stdout);
  assert.ok(record(output));
  return output;
}

function refusal(response: Response): void {
  assert.notEqual(response.code, 0);
  assert.equal(response.stdout, "");
  assert.notEqual(response.stderr.trim(), "");
}

export function entries(response: Data, key = "items"): Data[] {
  const list = response[key];
  assert.ok(Array.isArray(list));
  const values: unknown[] = list;
  return values.map((value) => {
    assert.ok(record(value));
    return value;
  });
}

export function id(response: Data): string {
  const { id } = response;
  assert.ok(typeof id === "string" && id.length > 0);
  return id;
}

export function memory(
  requestId: string,
  title: string,
  extra: Data = {}
): Data {
  return {
    requestId,
    kind: "knowledge",
    title,
    body: `${title}正文`,
    source: "隔离样例",
    conditions: "测试条件",
    tags: [],
    edges: [],
    ...extra
  };
}

export function edge(target: string, version = 1, type = "composition") {
  return { target, version, type, role: "依据" };
}
