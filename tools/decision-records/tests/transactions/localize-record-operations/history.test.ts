import { printDecisionFailure } from "../../../src/cli/output/cli-output.ts";
import { decisionFailure } from "../../../src/application-result.ts";
import {
  readDecisionHistoryIndex,
  DecisionHistoryEvidenceError
} from "../../../src/records/history/decision-history-sources.ts";
import {
  openVersionControl,
  VersionControlError
} from "../../../../shared/src/version-control/index.ts";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { loadDecisionMaintenanceContext } from "../../../src/maintenance/decision-maintenance-context.ts";
import { loadDecisionHistoryBaseline } from "../../../src/records/history/decision-history-baseline.ts";
import { pendingObjectPath } from "../../../../shared/tests/record-stage-evidence.ts";
import {
  a,
  b,
  fixture,
  parseIndex
} from "../../support/support-local-contracts.ts";
import {
  candidateDecisionBody,
  decisionFilePath,
  runGit,
  runSourceCli,
  withTemporaryWorkspace,
  writeDecision
} from "../../support/support.ts";

const indexPath = (root: string) =>
  path.join(root, "docs/decisions/decision-index.json");

test("Decision history gates load only selected historical payloads located by the HEAD index", async () => {
  await withTemporaryWorkspace("local-history-payload", async (root) => {
    await fixture(root, true);
    const missing = pendingObjectPath(root, "docs/decisions/" + b + ".md");
    await fs.unlink(missing);
    const result = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      await fs.readFile(decisionFilePath(root, "archive/" + a), "utf8"),
      /status: archived/
    );
    assert.equal(
      parseIndex(await fs.readFile(indexPath(root), "utf8")).entries[b]?.title,
      "原始 B"
    );
  });
});
test("Decision history gates diagnose a missing historical index instead of scanning formal blobs", async () => {
  await withTemporaryWorkspace("local-history-no-index", async (root) => {
    await fixture(root, true);
    runGit(root, ["rm", "--cached", "docs/decisions/decision-index.json"]);
    runGit(root, ["commit", "-m", "historical collection without index"]);
    const source = await fs.readFile(decisionFilePath(root, a));
    const index = await fs.readFile(indexPath(root));
    const result = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Git HEAD Decision index is missing/);
    assert.deepEqual(await fs.readFile(decisionFilePath(root, a)), source);
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
  });
});
test("Decision missing historical index preserves enumeration failure facts", async () => {
  await withTemporaryWorkspace("history-enumeration-failure", async (root) => {
    await fixture(root, true);
    const repository = await openVersionControl(root);
    const revision = (await repository.getCurrentRevision())!;
    const failure = new VersionControlError({
      code: "operation-failed",
      causeCategory: "access-denied",
      operation: "enumerate",
      target: "scope",
      detail: "denied"
    });
    await assert.rejects(
      readDecisionHistoryIndex(
        {
          ...repository,
          readRevisionFile: async () => null,
          listRevisionFiles: async () => {
            throw failure;
          }
        },
        revision,
        "docs/decisions"
      ),
      (error: unknown) => {
        assert.ok(error instanceof DecisionHistoryEvidenceError);
        assert.equal(error.source?.revision, revision);
        assert.equal(error.source?.path, "docs/decisions/decision-index.json");
        assert.equal(error.causes?.[0]?.code, "operation-failed");
        assert.equal(error.causes?.[0]?.versionControl?.detail, "denied");
        return true;
      }
    );
  });
});
test("Decision evolution checks recorded archived override targets without reading their workspace bodies", async () => {
  await withTemporaryWorkspace("history-override-target", async (root) => {
    await fixture(root, true);
    const archived = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(archived.exitCode, 0, archived.stderr);
    runGit(root, ["add", "."]);
    runGit(root, ["commit", "-m", "record archived predecessor"]);
    const archive = decisionFilePath(root, "archive/" + a);
    await fs.writeFile(archive, "unrelated unpublished archived corruption\n");
    const id = "261024-override-successor";
    await writeDecision(root, id, candidateDecisionBody({ id }));
    const result = await runSourceCli([
      "evolve",
      "--successor",
      "aligned=" + id,
      "--relation",
      "修订=" + a,
      "--root",
      root
    ]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      await fs.readFile(decisionFilePath(root, id), "utf8"),
      new RegExp("target: " + a)
    );
    assert.equal(
      await fs.readFile(archive, "utf8"),
      "unrelated unpublished archived corruption\n"
    );
  });
});
test("Decision multi-selected history rejects identities swapped between their indexed source paths", async () => {
  await withTemporaryWorkspace(
    "history-path-identity-binding",
    async (root) => {
      await fixture(root, true);
      const sourceA = decisionFilePath(root, a);
      const sourceB = decisionFilePath(root, b);
      const textA = await fs.readFile(sourceA);
      const textB = await fs.readFile(sourceB);
      const index = await fs.readFile(indexPath(root));
      await fs.writeFile(sourceA, textB);
      await fs.writeFile(sourceB, textA);
      runGit(root, ["add", "docs/decisions"]);
      runGit(root, ["commit", "-m", "historical identity swap"]);
      await fs.writeFile(sourceA, textA);
      await fs.writeFile(sourceB, textB);
      const pending = runGit(root, ["write-tree"]);
      const context = await loadDecisionMaintenanceContext(
        { workspaceRoot: root },
        {
          action: "archive",
          decisionIds: [a, b],
          keepUnrecordedHistory: false
        }
      );
      const result = await loadDecisionHistoryBaseline(context, [a, b]);
      assert.equal(result.status, "error");
      assert.match(JSON.stringify(result), /history-baseline-invalid/);
      assert.match(
        JSON.stringify(result),
        /identity differs.*source|identity differs.*260901-local-a/
      );
      assert.deepEqual(await fs.readFile(sourceA), textA);
      assert.deepEqual(await fs.readFile(sourceB), textB);
      assert.deepEqual(await fs.readFile(indexPath(root)), index);
      assert.equal(runGit(root, ["write-tree"]), pending);
    }
  );
});

test("Decision historical executable index is accepted without changing its mode", async () => {
  await withTemporaryWorkspace("history-executable-index", async (root) => {
    await fixture(root, true);
    runGit(root, [
      "update-index",
      "--chmod=+x",
      "docs/decisions/decision-index.json"
    ]);
    runGit(root, ["commit", "-m", "executable historical index"]);
    const result = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(
      runGit(root, ["ls-tree", "HEAD", "docs/decisions/decision-index.json"]),
      /^100755 /u
    );
  });
});

test("Decision invalid historical index blocks writes and reports its revision until committed repair", async () => {
  await withTemporaryWorkspace("history-invalid-index", async (root) => {
    await fixture(root, true);
    const index = await fs.readFile(indexPath(root));
    const source = await fs.readFile(decisionFilePath(root, a));
    await fs.writeFile(indexPath(root), Buffer.from("{invalid"));
    runGit(root, ["add", "docs/decisions/decision-index.json"]);
    runGit(root, ["commit", "-m", "invalid historical index"]);
    const revision = runGit(root, ["rev-parse", "HEAD"]).trim();
    await fs.writeFile(indexPath(root), index);
    const pending = runGit(root, ["write-tree"]);
    const result = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /state-index\.json-invalid/u);

    assert.ok(result.stderr.includes(revision));
    assert.deepEqual(await fs.readFile(indexPath(root)), index);
    assert.deepEqual(await fs.readFile(decisionFilePath(root, a)), source);
    assert.equal(runGit(root, ["write-tree"]), pending);
    runGit(root, ["add", "docs/decisions/decision-index.json"]);
    runGit(root, ["commit", "-m", "repair historical index"]);
    const repaired = await runSourceCli(["archive", a, "--root", root]);
    assert.equal(repaired.exitCode, 0, repaired.stderr);
  });
});

test("Decision diagnostic output preserves and sanitizes system evidence", () => {
  const lines: string[] = [];
  const locator = "/" + "long/".repeat(130) + "x\nY\rZ\u001b";
  const secret = `ghp_${"x".repeat(36)}`;
  printDecisionFailure(
    decisionFailure([
      {
        code: "history",
        target: "history",
        reason: "unavailable",
        recovery: "retry",
        causes: [
          {
            code: "operation-failed",
            detail: "failed",
            path: locator,
            versionControl: {
              causeCategory: "access-denied",
              operation: `read\n${secret}`,
              target: locator,
              detail: `independent ${secret}\r\u001b detail`
            }
          }
        ]
      }
    ]),
    { stdout: () => {}, stderr: (line) => lines.push(line) }
  );
  const output = lines.join("");
  assert.ok(
    output.includes(
      `versionControl.target: "${JSON.stringify(locator).slice(1, -1)}"`
    )
  );
  assert.ok(output.includes(`path: "${JSON.stringify(locator).slice(1, -1)}"`));
  assert.match(output, /versionControl\.causeCategory: access-denied/u);
  assert.match(output, /versionControl\.operation: read \[redacted\]/u);
  assert.match(
    output,
    /versionControl\.detail: independent \[redacted\].*detail/u
  );
  assert.ok(!output.includes(secret));
  assert.ok(!output.includes(String.fromCharCode(27)));
});
