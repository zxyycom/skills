import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { parse } from "yaml";

test(
  "dispatch input validation fails closed and separates acceptance from publication",
  { skip: process.platform === "win32" },
  () => {
    const workflow = parse(
      readFileSync(".github/workflows/package-skills.yml", "utf8")
    ) as {
      jobs: Record<string, { if?: string; steps?: Array<{ run?: string }> }>;
    };
    const script = workflow.jobs["validate-inputs"]?.steps?.[0]?.run;
    assert.ok(script);
    for (const [id, revision, expected] of [
      ["", "", 0],
      ["123", "a".repeat(40), 0],
      ["123", "", 1],
      ["", "a".repeat(40), 1],
      ["0", "a".repeat(40), 1],
      ["123", "x".repeat(40), 1]
    ] as const) {
      const status: number | null = spawnSync("bash", ["-c", script], {
        env: {
          ...process.env,
          ACCEPT_RELEASE_ID: id,
          ACCEPT_REVISION: revision
        }
      }).status;
      assert.equal(status, expected);
    }
    assert.match(
      workflow.jobs.publish?.if ?? "",
      /inputs\.accept_release_id == '' && inputs\.accept_revision == ''/
    );
    assert.match(
      workflow.jobs["accept-online"]?.if ?? "",
      /inputs\.accept_release_id != '' && inputs\.accept_revision != ''/
    );
  }
);
