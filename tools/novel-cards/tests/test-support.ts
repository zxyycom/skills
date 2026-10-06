import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { CardFailure, type CardFailureCode } from "../src/card.ts";
import { runCli } from "../src/cli.ts";

export function markdown(
  id: string,
  fields: Record<string, unknown> = {},
  body = "## 细纲\n因果及状态。\n## 导演视角\n切场与信息呈现。"
): string {
  return `---\n${stringify({ id, title: id, kind: "detail", domain: "plot", status: "expected", completeness: "expanded", ...fields })}---\n\n${body}\n`;
}
export async function put(
  root: string,
  name: string,
  text: string,
  area: "current" | "reference" = "current"
): Promise<void> {
  const directory = path.join(root, "cards", area);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${name}.md`), text);
}
export async function project(
  operation: (root: string) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "novel-cards-test-"));
  try {
    await fs.mkdir(path.join(root, "cards/current"), { recursive: true });
    await operation(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
export function failure(code: CardFailureCode): (error: unknown) => boolean {
  return (error: unknown) =>
    error instanceof CardFailure && error.code === code;
}
type CapturedCli = Readonly<{ status: number; stdout: string; stderr: string }>;
export async function cli(
  root: string,
  args: readonly string[]
): Promise<CapturedCli> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const status = await runCli([...args, "--root", root], {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text)
  });
  assert.equal(
    stdout.length,
    status === 2 ? 0 : 1,
    "one JSON result or no usage stdout"
  );
  assert.ok(stderr.length <= 1, "diagnostics remain on one stderr channel");
  if (stdout[0] !== undefined) JSON.parse(stdout[0]);
  return { status, stdout: stdout.join("\n"), stderr: stderr.join("\n") };
}
