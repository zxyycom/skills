import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  resolveGitHubAuthentication,
  type GitHubCliFailureReason
} from "../src/github-auth.ts";
import { runSkillUpdaterCli } from "../src/index.ts";
import type { AuthenticationFixtureEvent } from "./fixtures/mock-fetch.ts";
import {
  generatedUpdaterPath,
  remoteSkillMarkdown,
  runUpdater,
  skillUpdaterConfig,
  tempRoot,
  validManifest,
  validRelease,
  zipData
} from "./support.ts";

import {
  assertNoCredentialsLogged,
  withAuthenticationScenario,
  type AuthenticationScenario
} from "./authentication-support.ts";

function expectedRequests(
  token: string | null,
  tagged = false
): AuthenticationFixtureEvent[] {
  return [
    {
      kind: "request",
      url: tagged
        ? "https://api.github.com/repos/zxyycom/skills/releases/tags/review"
        : "https://api.github.com/repos/zxyycom/skills/releases/latest",
      authorization: token === null ? null : `Bearer ${token}`,
      accept: "application/vnd.github+json"
    },
    ...validRelease.assets.map((asset): AuthenticationFixtureEvent => ({
      kind: "request",
      url: asset.url,
      authorization: token === null ? null : `Bearer ${token}`,
      accept: "application/octet-stream"
    }))
  ];
}

const expectedGhLookup: AuthenticationFixtureEvent = {
  kind: "gh",
  command: "gh",
  args: ["auth", "token", "--hostname", "github.com"],
  tokenOverridesCleared: true,
  timeout: 5_000,
  nonInteractive: true
};

async function assertAnonymousResolution(
  scenario: AuthenticationScenario,
  reason: GitHubCliFailureReason
): Promise<void> {
  await withAuthenticationScenario(scenario, ({ events, output, warnings }) => {
    assert.deepEqual(resolveGitHubAuthentication(), { token: null, reason });
    assert.deepEqual(events, [expectedGhLookup]);
    assert.deepEqual([...output, ...warnings], []);
  });
}

function runSourceUpdater(
  name: string,
  args: readonly string[] = ["--yes"]
): Promise<number> {
  return runSkillUpdaterCli(
    skillUpdaterConfig,
    pathToFileURL(generatedUpdaterPath).href,
    [...args, "--target-dir", path.join(tempRoot, `auth-${name}`)]
  );
}

test("updater prefers GITHUB_TOKEN over GH_TOKEN without consulting gh", async () => {
  await withAuthenticationScenario(
    {
      env: {
        GITHUB_TOKEN: " fixture-github-token ",
        GH_TOKEN: "fixture-env-token"
      }
    },
    ({ events }) => {
      assert.deepEqual(resolveGitHubAuthentication(), {
        token: "fixture-github-token"
      });
      assert.deepEqual(events, []);
    }
  );
});

test("updater uses GH_TOKEN when GITHUB_TOKEN is blank without consulting gh", async () => {
  await withAuthenticationScenario(
    {
      env: {
        GITHUB_TOKEN: "  ",
        GH_TOKEN: " fixture-env-token\n"
      }
    },
    ({ events }) => {
      assert.deepEqual(resolveGitHubAuthentication(), {
        token: "fixture-env-token"
      });
      assert.deepEqual(events, []);
    }
  );
});

test("updater reuses one github.com gh credential lookup for release and asset requests", async () => {
  const logPath = path.join(tempRoot, "auth-distribution.jsonl");
  const target = path.join(tempRoot, "auth-distribution");
  await fs.writeFile(logPath, "");
  const result = runUpdater(
    path.join(import.meta.dirname, "fixtures/mock-github-auth.ts"),
    {
      args: ["--yes", "--release-tag", "review"],
      env: {
        GITHUB_TOKEN: " \n",
        GH_TOKEN: " \t",
        GH_HOST: "enterprise.example.test",
        SKILLS_TEST_AUTH_LOG: logPath
      },
      manifest: validManifest,
      release: validRelease,
      targetDir: target,
      zipData
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assertNoCredentialsLogged(result.stdout + result.stderr);
  const events = (await fs.readFile(logPath, "utf8"))
    .trim()
    .split("\n")
    .map((line): unknown => JSON.parse(line));
  assert.deepEqual(events, [
    expectedGhLookup,
    ...expectedRequests("fixture-gh-token", true)
  ]);
  assert.equal(
    await fs.readFile(path.join(target, "SKILL.md"), "utf8"),
    remoteSkillMarkdown
  );
});

test("updater resolves anonymous authentication without gh installed", async () => {
  await assertAnonymousResolution({ errorCode: "ENOENT" }, "not-installed");
});

test("updater ignores credentials from a failed gh command", async () => {
  await assertAnonymousResolution({ status: 1 }, "command-failed");
});

test("updater rejects malformed environment credentials before requests", async () => {
  await withAuthenticationScenario(
    {
      env: {
        GITHUB_TOKEN: "fixture-github-token\nextra",
        GH_TOKEN: "fixture-env-token"
      }
    },
    ({ events }) => {
      assert.throws(resolveGitHubAuthentication, (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /GITHUB_TOKEN\/GH_TOKEN.*visible ASCII/u);
        assertNoCredentialsLogged(error.message);
        return true;
      });
      assert.deepEqual(events, []);
    }
  );
});

test("updater ignores malformed gh credential output", async () => {
  await assertAnonymousResolution(
    { stdout: "fixture-gh-token\nextra" },
    "invalid-output"
  );
});

test("updater resolves anonymous authentication when gh returns only whitespace", async () => {
  await assertAnonymousResolution({ stdout: " \n" }, "empty-output");
});

test("updater resolves anonymous authentication when gh credential lookup times out", async () => {
  await assertAnonymousResolution({ errorCode: "ETIMEDOUT" }, "timed-out");
});

test("updater warns when using anonymous authentication", async () => {
  await withAuthenticationScenario(
    { errorCode: "ENOENT" },
    async ({ events, warnings }) => {
      assert.equal(await runSourceUpdater("anonymous"), 0);
      assert.deepEqual(events, [expectedGhLookup, ...expectedRequests(null)]);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /gh is not installed/u);
      assert.match(
        warnings[0],
        /unauthenticated GitHub requests with shared IP rate limits/u
      );
      assert.match(warnings[0], /gh auth login --hostname github\.com/u);
      assert.equal(
        await fs.readFile(
          path.join(tempRoot, "auth-anonymous/SKILL.md"),
          "utf8"
        ),
        remoteSkillMarkdown
      );
    }
  );
});

test("updater help skips credential lookup and network requests", async () => {
  await withAuthenticationScenario({}, async ({ events, output, warnings }) => {
    assert.equal(await runSourceUpdater("help", ["--help"]), 0);
    assert.match(output.join("\n"), /GitHub authentication:/u);
    assert.deepEqual(events, []);
    assert.deepEqual(warnings, []);
  });
});

test("updater import skips credential lookup and network requests", async () => {
  const logPath = path.join(tempRoot, "auth-import.jsonl");
  await fs.writeFile(logPath, "");
  const importer = path.join(tempRoot, "auth-importer.mjs");
  await fs.writeFile(
    importer,
    `await import(${JSON.stringify(pathToFileURL(generatedUpdaterPath).href)});`
  );
  const result = runUpdater(
    path.join(import.meta.dirname, "fixtures/mock-github-auth.ts"),
    {
      args: [],
      updaterPath: importer,
      env: { GITHUB_TOKEN: "", GH_TOKEN: "", SKILLS_TEST_AUTH_LOG: logPath },
      manifest: validManifest,
      release: validRelease,
      targetDir: tempRoot,
      zipData
    }
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout + result.stderr, "");
  assert.equal(await fs.readFile(logPath, "utf8"), "");
});

test("updater rejects unrelated targets before credential lookup", async () => {
  const target = path.join(tempRoot, "auth-invalid-target");
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "unrelated.txt"), "not a skill");
  await withAuthenticationScenario({}, async ({ events, warnings }) => {
    await assert.rejects(runSourceUpdater("invalid-target"), /SKILL\.md/u);
    assert.deepEqual(events, []);
    assert.deepEqual(warnings, []);
    assert.equal(
      await fs.readFile(path.join(target, "unrelated.txt"), "utf8"),
      "not a skill"
    );
  });
});

test("updater preserves HTTP authentication failures without anonymous retries", async () => {
  await withAuthenticationScenario(
    { httpStatus: 401 },
    async ({ events, warnings }) => {
      await assert.rejects(
        runSourceUpdater("http-auth-failure"),
        /GitHub release lookup failed \(401\)/u
      );
      assert.deepEqual(events, [
        expectedGhLookup,
        expectedRequests("fixture-gh-token")[0]
      ]);
      assert.deepEqual(warnings, []);
    }
  );
});
