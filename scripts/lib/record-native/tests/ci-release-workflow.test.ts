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

test("package job prepares the native runtime before its release Gate", () => {
  const workflow = parse(
    readFileSync(".github/workflows/package-skills.yml", "utf8")
  ) as {
    jobs: Record<string, { steps?: Array<{ name?: string; run?: string }> }>;
  };
  const steps = workflow.jobs.package?.steps ?? [];
  const prepare = steps.findIndex(
    (step) => step.name === "Prepare and validate native repository runtime"
  );
  const release = steps.findIndex(
    (step) => step.name === "Validate and package"
  );
  assert.ok(prepare >= 0 && prepare < release);
  const prepareScript = steps[prepare]?.run ?? "";
  const fetch = prepareScript.indexOf(
    "cargo +1.98.1 fetch --manifest-path tools/record-cli/Cargo.toml --locked"
  );
  const build = prepareScript.indexOf("bun run prepare:record-native");
  const check = prepareScript.indexOf(
    "node scripts/prepare-record-native.ts --check"
  );
  assert.ok(fetch >= 0 && fetch < build && build < check);
  assert.match(steps[release]?.run ?? "", /--tag release/u);
});

test("online acceptance checks out the tested harness independently of release identity", () => {
  const workflow = parse(
    readFileSync(".github/workflows/package-skills.yml", "utf8")
  ) as {
    jobs: Record<
      string,
      {
        steps?: Array<{
          name?: string;
          uses?: string;
          with?: { ref?: string };
          run?: string;
          env?: Record<string, string>;
        }>;
      }
    >;
  };
  const steps = workflow.jobs["accept-online"]?.steps ?? [];
  const checkout = steps.findIndex(
    (step) => step.uses === "actions/checkout@v7"
  );
  const verify = steps.findIndex(
    (step) => step.name === "Verify acceptance harness revision"
  );
  const accept = steps.findIndex(
    (step) =>
      step.name === "Accept exact published release in isolated directories"
  );
  assert.ok(checkout >= 0 && checkout < verify && verify < accept);
  assert.equal(
    steps[checkout]?.with?.ref,
    "${{ needs.package.outputs.tested_revision }}"
  );
  assert.equal(
    steps[verify]?.env?.TESTED_REVISION,
    "${{ needs.package.outputs.tested_revision }}"
  );
  assert.match(steps[verify]?.run ?? "", /git rev-parse HEAD/u);
  assert.equal(
    steps[accept]?.env?.ACCEPT_REVISION,
    "${{ inputs.accept_revision }}"
  );
  assert.match(
    steps[accept]?.run ?? "",
    /"\$ACCEPT_RELEASE_ID" "\$ACCEPT_REVISION"/u
  );
});
