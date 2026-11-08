import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  candidateGithubRemote,
  isExpectedOrigin
} from "../candidate-publish-github.ts";

test("native GitHub adapter pins origin and release API context", async () => {
  assert.equal(isExpectedOrigin("https://github.com/zxyycom/skills.git"), true);
  assert.equal(isExpectedOrigin("git@github.com:zxyycom/skills.git"), true);
  assert.equal(
    isExpectedOrigin("https://token@github.com/zxyycom/skills.git"),
    false
  );
  assert.equal(isExpectedOrigin("https://github.com/other/skills.git"), false);
  const local = await fs.mkdtemp(
    path.join(os.tmpdir(), "native-publish-target-")
  );
  try {
    execFileSync("git", ["init", "-q", local]);
    execFileSync("git", [
      "-C",
      local,
      "remote",
      "add",
      "origin",
      "https://github.com/zxyycom/skills.git"
    ]);
    execFileSync("git", [
      "-C",
      local,
      "config",
      "url.https://else.invalid/.pushInsteadOf",
      "https://github.com/"
    ]);
    const effectivePush = execFileSync(
      "git",
      ["-C", local, "remote", "get-url", "--push", "--all", "origin"],
      { encoding: "utf8" }
    ).trim();
    assert.equal(isExpectedOrigin(effectivePush), false);
    if (process.platform !== "win32") {
      const fake = path.join(local, "gh"),
        log = path.join(local, "gh.log");
      await fs.writeFile(
        fake,
        `#!/bin/sh
printf '%s\n%s\n%s\n' "$GH_HOST" "$GH_REPO" "$*" > "$RECORD_FAKE_LOG"
if [ "$1" = "api" ]; then printf '%s' '{"tag_name":"skills-latest","id":17}'; else printf '%s' '{"tagName":"skills-latest","databaseId":17,"assets":[]}'; fi
`,
        { mode: 0o755 }
      );
      const previous = {
        PATH: process.env.PATH,
        GH_HOST: process.env.GH_HOST,
        GH_REPO: process.env.GH_REPO,
        RECORD_FAKE_LOG: process.env.RECORD_FAKE_LOG
      };
      try {
        process.env.PATH = `${local}${path.delimiter}${previous.PATH ?? ""}`;
        process.env.GH_HOST = "wrong.example";
        process.env.GH_REPO = "wrong/repo";
        process.env.RECORD_FAKE_LOG = log;
        assert.deepEqual(
          await candidateGithubRemote(local).readRelease("skills-latest"),
          []
        );
        const lines = (await fs.readFile(log, "utf8")).split("\n");
        assert.equal(lines[0], "github.com");
        assert.equal(lines[1], "github.com/zxyycom/skills");
        assert.match(lines[2]!, /--repo github\.com\/zxyycom\/skills/);
        assert.deepEqual(await candidateGithubRemote(local).readLatest(), {
          tag: "skills-latest",
          id: 17
        });
        const api = (await fs.readFile(log, "utf8")).split("\n");
        assert.match(
          api[2]!,
          /api --hostname github\.com repos\/zxyycom\/skills\/releases\/latest/
        );
      } finally {
        for (const [name, value] of Object.entries(previous)) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
    }
  } finally {
    await fs.rm(local, { recursive: true, force: true });
  }
});
