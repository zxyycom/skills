import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runChangePlanCli } from "../src/cli.ts";
import {
  completedTasks,
  generatedCliPath,
  withTempRoot,
  writePlan
} from "./support.ts";

type Execution = Readonly<{ exitCode: number; stderr: string; stdout: string }>;

async function runCli(
  args: readonly string[],
  cwd: string
): Promise<Execution> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runChangePlanCli(args, {
    cwd,
    io: {
      stderr: (text) => stderr.push(text),
      stdout: (text) => stdout.push(text)
    }
  });
  return { exitCode, stderr: stderr.join(""), stdout: stdout.join("") };
}

function commitAll(root: string): void {
  execFileSync("git", ["-C", root, "add", "."], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "record plan"], {
    encoding: "utf8"
  });
}

test("CLI exposes active commands and rejects archive-era options", async () => {
  await withTempRoot("cli-active", async (root) => {
    const help = await runCli(["--help"], root);
    assert.equal(help.exitCode, 0);
    assert.match(help.stdout, /complete <change-directory>/u);
    assert.doesNotMatch(
      help.stdout,
      /archive <change-directory>|--archived|--all/u
    );
    const invalid = await runCli(["list", "--archived"], root);
    assert.equal(invalid.exitCode, 2);
    assert.match(invalid.stderr, /Unknown option/u);
  });
});

test("CLI reports complete preflight and generated Node runtime preserves its protocol", async () => {
  await withTempRoot("cli-complete", async (root) => {
    const change = await writePlan(
      path.join(root, "changes"),
      "finished-plan",
      {
        tasks: completedTasks
      }
    );
    commitAll(root);
    const preflight = await runCli(
      ["complete", change, "--preflight", "--json"],
      root
    );
    assert.equal(preflight.exitCode, 0, preflight.stderr);
    const parsed = JSON.parse(preflight.stdout) as {
      outcome: string;
      changed: boolean;
    };
    assert.equal(parsed.outcome, "preflight");
    assert.equal(parsed.changed, false);

    const generated = spawnSync(
      "node",
      [generatedCliPath, "complete", change, "--preflight", "--json"],
      { cwd: root, encoding: "utf8" }
    );
    assert.equal(generated.status, 0, generated.stderr);
    assert.equal(
      (JSON.parse(generated.stdout) as { outcome: string }).outcome,
      "preflight"
    );
  });
});

test("CLI reports committed cleanup pending with recovery details in text and JSON", async () => {
  await withTempRoot("cli-complete-pending", async (root) => {
    const changes = path.join(root, "changes");
    const textChange = await writePlan(changes, "text-pending", {
      tasks: completedTasks
    });
    const jsonChange = await writePlan(changes, "json-pending", {
      tasks: completedTasks
    });
    commitAll(root);

    const originalUnlink = fs.unlink.bind(fs);
    const runWithInjectedCleanupFailure = async (
      args: readonly string[]
    ): Promise<Execution> => {
      let injected = false;
      Object.defineProperty(fs, "unlink", {
        configurable: true,
        value: async (...arguments_: Parameters<typeof fs.unlink>) => {
          if (!injected) {
            injected = true;
            throw new Error("injected CLI cleanup failure");
          }
          return await originalUnlink(...arguments_);
        },
        writable: true
      });
      try {
        return await runCli(args, root);
      } finally {
        Object.defineProperty(fs, "unlink", {
          configurable: true,
          value: originalUnlink,
          writable: true
        });
      }
    };

    const text = await runWithInjectedCleanupFailure(["complete", textChange]);
    assert.equal(text.exitCode, 0, text.stderr);
    assert.match(text.stdout, /committed-cleanup-pending/u);
    assert.match(text.stdout, /HEAD recovery/u);
    assert.match(text.stdout, /members\)/u);
    assert.match(text.stdout, /Tombstone requires cleanup:/u);
    assert.match(text.stderr, /Cleanup diagnostic:/u);

    const json = await runWithInjectedCleanupFailure([
      "complete",
      jsonChange,
      "--json"
    ]);
    assert.equal(json.exitCode, 0, json.stderr);
    const parsed = JSON.parse(json.stdout) as {
      changed: boolean;
      error: string | null;
      headCommit: string | null;
      memberCount: number;
      outcome: string;
      tombstoneDirectory: string | null;
    };
    assert.equal(parsed.outcome, "committed-cleanup-pending");
    assert.equal(parsed.changed, true);
    assert.notEqual(parsed.headCommit, null);
    assert.ok(parsed.memberCount > 0);
    assert.notEqual(parsed.tombstoneDirectory, null);
    assert.notEqual(parsed.error, null);
  });
});

test("CLI supports direct members of a custom Change root", async () => {
  await withTempRoot("cli-custom-root", async (root) => {
    const changeRoot = path.join(root, "change-work");
    const plan = await writePlan(changeRoot, "archive", {
      tasks: completedTasks
    });
    const draft = await writePlan(changeRoot, "custom-draft", {
      metadata: { stage: "draft" }
    });
    commitAll(root);

    const checked = await runCli(["check", plan, "--json"], root);
    assert.equal(checked.exitCode, 0, checked.stderr);
    assert.equal(
      (JSON.parse(checked.stdout) as { valid: boolean }).valid,
      true
    );

    const shown = await runCli(["show", plan, "--json"], root);
    assert.equal(shown.exitCode, 0, shown.stderr);
    assert.notEqual(
      (
        JSON.parse(shown.stdout) as {
          artifacts: { "proposal.md": string | null };
        }
      ).artifacts["proposal.md"],
      null
    );

    const planned = await runCli(["plan", draft, "--json"], root);
    assert.equal(planned.exitCode, 0, planned.stderr);
    assert.equal(
      (JSON.parse(planned.stdout) as { metadata: { stage: string } }).metadata
        .stage,
      "plan"
    );

    const completed = await runCli(
      ["complete", plan, "--preflight", "--json"],
      root
    );
    assert.equal(completed.exitCode, 0, completed.stderr);
    assert.equal(
      (JSON.parse(completed.stdout) as { outcome: string }).outcome,
      "preflight"
    );
  });
});

test("CLI rejects tombstone and nested paths for every single-directory command", async () => {
  await withTempRoot("cli-active-targets", async (root) => {
    const changes = path.join(root, "changes");
    const customRoot = path.join(root, "custom-change-root");
    const defaultTombstone = await writePlan(
      path.join(changes, ".change-plan-tombstones"),
      "private",
      { tasks: completedTasks }
    );
    const customTombstone = await writePlan(
      path.join(customRoot, ".change-plan-tombstones"),
      "private",
      { tasks: completedTasks }
    );
    const defaultTombstoneDescendant = await writePlan(
      path.join(changes, ".change-plan-tombstones", "foreign"),
      "nested-plan",
      { tasks: completedTasks }
    );
    const customTombstoneDescendant = await writePlan(
      path.join(customRoot, ".change-plan-tombstones", "foreign"),
      "nested-plan",
      { tasks: completedTasks }
    );
    const outer = await writePlan(customRoot, "outer", {
      tasks: completedTasks
    });
    const nested = await writePlan(outer, "nested", {
      tasks: completedTasks
    });
    commitAll(root);

    const targets = [
      defaultTombstone,
      customTombstone,
      defaultTombstoneDescendant,
      customTombstoneDescendant,
      nested
    ];
    const metadataBefore = await Promise.all(
      targets.map(
        async (target) =>
          await fs.readFile(path.join(target, ".change-plan.json"), "utf8")
      )
    );
    for (const target of targets) {
      const checked = await runCli(["check", target, "--json"], root);
      assert.equal(checked.exitCode, 1);
      assert.ok(
        (
          JSON.parse(checked.stdout) as { diagnostics: Array<{ code: string }> }
        ).diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "change-directory-not-active-member"
        )
      );

      const originalReadFile = fs.readFile.bind(fs);
      let readRejectedTarget = false;
      Object.defineProperty(fs, "readFile", {
        configurable: true,
        value: async (...arguments_: Parameters<typeof fs.readFile>) => {
          if (
            typeof arguments_[0] === "string" &&
            arguments_[0].startsWith(target)
          ) {
            readRejectedTarget = true;
            throw new Error("public show read a rejected target");
          }
          return await originalReadFile(...arguments_);
        },
        writable: true
      });
      let shown;
      try {
        shown = await runCli(["show", target], root);
      } finally {
        Object.defineProperty(fs, "readFile", {
          configurable: true,
          value: originalReadFile,
          writable: true
        });
      }
      assert.equal(shown.exitCode, 1);
      assert.match(shown.stderr, /not-active-member/u);
      assert.equal(readRejectedTarget, false);

      const planned = await runCli(["plan", target, "--json"], root);
      assert.equal(planned.exitCode, 1);
      assert.equal(
        (JSON.parse(planned.stdout) as { success: boolean }).success,
        false
      );

      const completed = await runCli(["complete", target, "--json"], root);
      assert.equal(completed.exitCode, 1);
      assert.equal(
        (JSON.parse(completed.stdout) as { outcome: string }).outcome,
        "no-change"
      );
    }
    await Promise.all(
      targets.map(
        async (target) =>
          await assert.rejects(
            fs.access(
              path.join(path.dirname(target), ".change-plan-tombstones")
            )
          )
      )
    );
    const metadataAfter = await Promise.all(
      targets.map(
        async (target) =>
          await fs.readFile(path.join(target, ".change-plan.json"), "utf8")
      )
    );
    assert.deepEqual(metadataAfter, metadataBefore);
  });
});

test("CLI keeps list, show, check, check-all, and plan text/JSON contracts on current changes", async () => {
  await withTempRoot("cli-current-commands", async (root) => {
    const changes = path.join(root, "changes");
    const valid = await writePlan(changes, "valid-plan");
    const invalid = path.join(changes, "invalid-plan");
    await fs.mkdir(invalid, { recursive: true });
    const draft = await writePlan(changes, "draft-plan", {
      metadata: { stage: "draft" }
    });

    const listed = await runCli(
      ["list", changes, "--stage", "plan", "--json"],
      root
    );
    assert.equal(listed.exitCode, 0, listed.stderr);
    const listedJson = JSON.parse(listed.stdout) as {
      entries: Array<{ changeName: string; stage: string | null }>;
    };
    assert.deepEqual(
      listedJson.entries.map((entry) => entry.changeName),
      ["valid-plan"]
    );
    assert.equal(listedJson.entries[0]?.stage, "plan");

    const shown = await runCli(["show", valid], root);
    assert.equal(shown.exitCode, 0, shown.stderr);
    assert.match(shown.stdout, /Change: valid-plan/u);
    assert.match(shown.stdout, /--- proposal\.md ---/u);

    const checked = await runCli(["check", invalid, "--json"], root);
    assert.equal(checked.exitCode, 1);
    assert.equal(
      (JSON.parse(checked.stdout) as { valid: boolean }).valid,
      false
    );

    const collection = await runCli(["check-all", changes], root);
    assert.equal(collection.exitCode, 1);
    assert.match(collection.stderr, /collection check failed/u);

    const planned = await runCli(["plan", draft, "--json"], root);
    assert.equal(planned.exitCode, 0, planned.stderr);
    const plannedJson = JSON.parse(planned.stdout) as {
      metadata: { stage: string };
      success: boolean;
    };
    assert.equal(plannedJson.success, true);
    assert.equal(plannedJson.metadata.stage, "plan");
  });
});
