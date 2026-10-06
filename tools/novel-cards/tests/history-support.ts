import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { synchronize } from "../src/index.ts";
import { cli, markdown, put } from "./test-support.ts";

export async function stateProject(root: string): Promise<void> {
  await put(root, "event", markdown("event", { status: "occurred" }));
  await put(
    root,
    "hero",
    markdown(
      "hero",
      { domain: "character", status: "occurred", state_at: "event@1" },
      "原先持钥匙"
    )
  );
  await put(
    root,
    "gate",
    markdown(
      "gate",
      { domain: "setting", status: "occurred", state_at: "event@1" },
      "原先集中许可"
    )
  );
  await synchronize(root);
}
export function transition(
  id = "handover",
  version = 1,
  fields: Record<string, unknown> = {}
): string {
  return markdown(
    id,
    {
      kind: "transition",
      domain: "history",
      status: "occurred",
      version,
      transition: {
        mode: "evolution",
        lifecycle: "active",
        events: ["event@1"],
        changes: [
          { before: "hero@1", after: "hero@2" },
          { before: "gate@1", after: "gate@2" }
        ],
        ...fields
      }
    },
    "钥匙移交导致公开复核；并非一句历史摘要。"
  );
}
export async function batchFile(
  root: string,
  record: string,
  updates: readonly { id: string; markdown: string }[] = []
): Promise<string> {
  const input = path.join(root, "batch.json");
  await fs.writeFile(input, JSON.stringify({ transition: record, updates }));
  return input;
}
export function updates(version = 2): { id: string; markdown: string }[] {
  return [
    {
      id: "hero",
      markdown: markdown(
        "hero",
        {
          version,
          domain: "character",
          status: "occurred",
          state_at: "event@1"
        },
        "现在归还钥匙"
      )
    },
    {
      id: "gate",
      markdown: markdown(
        "gate",
        { version, domain: "setting", status: "occurred", state_at: "event@1" },
        "现在公开复核"
      )
    }
  ];
}
export async function firstChange(root: string): Promise<void> {
  await stateProject(root);
  const applied = await cli(root, [
    "apply-transition",
    "--input",
    await batchFile(root, transition(), updates()),
    "--write"
  ]);
  assert.equal(applied.status, 0, applied.stderr);
}
