import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { runInvestigationReportCheckCli } from "../src/cli.ts";
import {
  investigationRoot,
  reportMarkdown,
  withTempRoot
} from "./fixture-support.ts";
import { runInvestigationCli } from "./cli-support.ts";
import { writeCollection } from "./collection-support.ts";

test("CLI rejects repeated single-value options before any collection access or candidate creation", async () => {
  await withTempRoot("cli-single-options", async (root) => {
    const newArgs = [
      "new",
      "history",
      "--title",
      "History",
      "--question",
      "Why?",
      "--tag",
      "history"
    ];
    const cases = [
      [
        ...newArgs,
        "--formed-at",
        "2020-01-02T00:00:00Z",
        "--formed-at",
        "2020-01-02T00:00:00Z"
      ],
      [...newArgs, "--title", "Other"],
      [...newArgs, "--question", "Other?"],
      ["show", "report", "--root", root],
      [
        "candidates",
        "--investigations-dir",
        "docs/investigations",
        "--investigations-dir",
        "other"
      ],
      ["stage", "report", "--scope", "domain", "--scope", "all"],
      ["trace", "report", "--depth", "all", "--depth", "1"],
      ["sync-index", "--preflight", "--preflight"]
    ];
    for (const [option, value] of [
      ["in", "metadata"],
      ["match", "phrase"],
      ["formed-from", "2099-01-01T00:00:00Z"],
      ["formed-to", "2099-01-01T00:00:00Z"],
      ["limit", "1"],
      ["related-to", "report"],
      ["direction", "both"],
      ["relation-type", "补充"]
    ]) {
      cases.push([
        "search",
        "report",
        `--${option}`,
        value!,
        `--${option}`,
        value!
      ]);
    }
    for (const args of cases) {
      const result = await runInvestigationCli(root, args);
      assert.equal(result.status, 2, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.match(result.stderr, /only once/u);
      assert.deepEqual(await fs.readdir(root), []);
    }
    const valid = await runInvestigationCli(root, [
      ...newArgs,
      "--formed-at",
      "2020-01-02T00:00:00Z",
      "--tag",
      "investigation-report"
    ]);
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /200102-history/u);
    assert.match(valid.stdout, /title: History/u);
  });
});

test("CLI search distinguishes invalid arguments from runtime source failures", async () => {
  await withTempRoot("cli-search-failures", async (root) => {
    for (const args of [
      ["--match", "bogus"],
      ["--limit", "-1"],
      ["--limit", "zero"],
      ["--in", "bogus"],
      ["--formed-from", "invalid"],
      [
        "--formed-from",
        "2099-01-01T00:00:00Z",
        "--formed-to",
        "2000-01-01T00:00:00Z"
      ]
    ]) {
      const result = await runInvestigationCli(root, [
        "search",
        "report",
        ...args
      ]);
      assert.equal(result.status, 2, args.join(" "));
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        /Invalid investigation report search options/u
      );
      assert.deepEqual(await fs.readdir(root), []);
    }
    await writeCollection(root, [{ id: "report" }]);
    const success = await runInvestigationCli(root, [
      "search",
      "report",
      "--in",
      "metadata"
    ]);
    assert.equal(success.status, 0, success.stderr);
    assert.match(success.stdout, /published-index/u);
    assert.equal(success.stderr, "");
    await fs.writeFile(
      path.join(investigationRoot(root), "report.md"),
      "invalid report"
    );
    const failed = await runInvestigationCli(root, ["search", "report"]);
    assert.equal(failed.status, 1);
    assert.equal(failed.stdout, "");
    assert.match(failed.stderr, /Investigation report search failed/u);
  });
});

test("CLI show-candidate exposes all readiness states and rejects only invalid scaffolds", async () => {
  await withTempRoot("cli-candidate-contract", async (root) => {
    await writeCollection(root, [{ id: "formal" }]);
    const candidatePath = path.join(investigationRoot(root), "_candidate.next");
    const complete = reportMarkdown({ id: "next" });
    await fs.writeFile(candidatePath, complete);
    const ready = await runInvestigationCli(root, ["show-candidate", "next"]);
    assert.equal(ready.status, 0, ready.stderr);
    for (const field of ["scaffoldValid", "bodyReady", "resourceReady"])
      assert.match(ready.stdout, new RegExp(`${field}: true`, "u"));
    assert.equal(ready.stderr, "");
    const incomplete = complete.replace("回答本轮直接问题。", "");
    await fs.writeFile(candidatePath, incomplete);
    const body = await runInvestigationCli(root, ["show-candidate", "next"]);
    assert.equal(body.status, 0, body.stderr);
    assert.match(
      body.stdout,
      /scaffoldValid: true\nbodyReady: false\nresourceReady: true/u
    );
    assert.match(body.stderr, /must not be empty/u);
    await fs.writeFile(
      candidatePath,
      reportMarkdown({ id: "next", resources: ["next/missing.txt"] })
    );
    const resource = await runInvestigationCli(root, [
      "show-candidate",
      "next"
    ]);
    assert.equal(resource.status, 0, resource.stderr);
    assert.match(
      resource.stdout,
      /scaffoldValid: true\nbodyReady: true\nresourceReady: false/u
    );
    assert.notEqual(resource.stderr, "");
    for (const invalid of [
      complete.replace("## 调查目的", "## 非法章节"),
      complete.replace('  - "investigation-report"', "  - INVALID TAG")
    ]) {
      await fs.writeFile(candidatePath, invalid);
      const shown = await runInvestigationCli(root, ["show-candidate", "next"]);
      assert.equal(shown.status, 1);
      assert.equal(shown.stdout, "");
      assert.notEqual(shown.stderr, "");
      const listed = await runInvestigationCli(root, ["candidates"]);
      assert.equal(listed.status, 0, listed.stderr);
      assert.match(listed.stdout, /No investigation candidates found/u);
      assert.match(listed.stderr, /warning/u);
      const publish = await runInvestigationCli(root, [
        "publish",
        "next",
        "--preflight"
      ]);
      assert.equal(publish.status, 1);
      assert.equal(await fs.readFile(candidatePath, "utf8"), invalid);
    }
  });
});

test("CLI new ends after local creation without an auxiliary publish preflight", async () => {
  await withTempRoot("cli-new-auxiliary-unavailable", async (root) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    let afterCreation = false;
    let postCreationReads = 0;
    const original = fs.readdir;
    fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
      if (args[0] === investigationRoot(root) && afterCreation) {
        postCreationReads += 1;
        throw Object.assign(new Error("collection access denied"), {
          code: "EACCES"
        });
      }
      return await original(...args);
    }) as typeof fs.readdir;
    let status;
    try {
      status = await runInvestigationReportCheckCli(
        [
          "--root",
          root,
          "new",
          "history",
          "--title",
          "History",
          "--question",
          "Why?",
          "--tag",
          "history",
          "--formed-at",
          "2020-01-02T00:00:00Z"
        ],
        {
          io: {
            stdout: (text) => {
              stdout.push(text);
              if (text.includes("Investigation candidate created:"))
                afterCreation = true;
            },
            stderr: (text) => stderr.push(text)
          }
        }
      );
    } finally {
      fs.readdir = original;
    }
    assert.equal(status, 0);
    assert.match(
      stdout.join(""),
      /Investigation candidate created: 200102-history/u
    );
    assert.doesNotMatch(stdout.join(""), /preflight/u);
    assert.equal(postCreationReads, 0);
    assert.doesNotMatch(stderr.join(""), /candidate-preflight-unavailable/u);
    assert.match(
      await fs.readFile(
        path.join(investigationRoot(root), "_candidate.history"),
        "utf8"
      ),
      /id: "200102-history"/u
    );
  });
});
