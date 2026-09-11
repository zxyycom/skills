import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { runInvestigationReportCheckCli } from "../src/cli.ts";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "../src/collection-mutation-lock.ts";
import {
  diagnosticFromError,
  genericInvestigationDiagnostic,
  renderInvestigationDiagnostic
} from "../src/diagnostics.ts";
import { setInvestigationRelations } from "../src/relation-transaction.ts";
import {
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

test("set-relations parses complete source groups and rejects ambiguous grouping", async () => {
  await withTempRoot("groups", async (root) => {
    await writeCollection(root, [{ id: "base" }, { id: "next" }]);
    const invalid = await runInvestigationReportCheckCli([
      "set-relations",
      "--root",
      root,
      "--relation",
      "补充=base.md"
    ]);
    assert.equal(invalid, 2);
    const nonCanonicalSource = await setInvestigationRelations({
      replacements: [
        {
          relations: [{ target: "base", type: "补充" }],
          source: "./next.md"
        }
      ],
      workspaceRoot: root
    });
    assert.ok(
      nonCanonicalSource.errors.some((error) =>
        error.includes("source must use")
      )
    );
    const nonCanonicalTarget = await setInvestigationRelations({
      replacements: [
        {
          relations: [
            { target: "./base.md", type: "补充" },
            { target: " base.md ", type: "复查" }
          ],
          source: "next"
        }
      ],
      workspaceRoot: root
    });
    assert.ok(
      nonCanonicalTarget.errors.some((error) => error.includes("target"))
    );
  });
});

test("collection mutation lock distinguishes busy access and release failures", async () => {
  await withTempRoot("collection-lock-diagnostics", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const indexPath = `${investigationRoot(root)}/investigation-index.json`;
    for (const [fileSystemCode, expectedCode, expectedCause] of [
      ["EEXIST", "investigation-report.collection-lock-busy", "busy"],
      [
        "EACCES",
        "investigation-report.collection-lock-access-denied",
        "access-denied"
      ],
      ["EIO", "investigation-report.collection-lock-unavailable", "unknown"]
    ] as const) {
      const failure = Object.assign(new Error(fileSystemCode), {
        code: fileSystemCode
      });
      await assert.rejects(
        withInvestigationCollectionMutationLock(
          indexPath,
          async () => undefined,
          { open: async () => Promise.reject(failure) }
        ),
        (error: unknown) => {
          assert.ok(error instanceof InvestigationCollectionMutationLockError);
          assert.equal(error.diagnostic.code, expectedCode);
          assert.equal(error.diagnostic.causeCategory, expectedCause);
          return true;
        }
      );
    }

    await assert.rejects(
      withInvestigationCollectionMutationLock(
        indexPath,
        async () => undefined,
        {
          rm: async () => {
            throw Object.assign(new Error("release failed"), { code: "EIO" });
          }
        }
      ),
      (error: unknown) => {
        assert.ok(error instanceof InvestigationCollectionMutationLockError);
        assert.equal(
          error.diagnostic.code,
          "investigation-report.collection-lock-release-failed"
        );
        return true;
      }
    );
    await fs.rm(`${root}/docs/.investigation-index.json.mutation.lock`, {
      force: true
    });
  });
});

test("investigation diagnostics sanitize external failure details", () => {
  const token = `ghp_${"x".repeat(36)}`;
  const diagnostic = diagnosticFromError({
    code: "investigation-report.test-failure",
    error: new Error(
      `token=${token}\nfailed while reading /private/workspace/secret.md ${"z".repeat(700)}`
    ),
    reason: "a test-only external operation failed",
    recovery: "correct the test-only failure and retry",
    target: "test target"
  });
  assert.ok(diagnostic.detail !== null);
  assert.ok(diagnostic.detail !== undefined);
  assert.doesNotMatch(diagnostic.detail, new RegExp(token, "u"));
  assert.doesNotMatch(diagnostic.detail, /\/private\/workspace\/secret\.md/u);
  assert.doesNotMatch(diagnostic.detail, /\n/u);
  assert.ok(diagnostic.detail.length <= 500);
  assert.doesNotMatch(
    renderInvestigationDiagnostic(diagnostic).join("\n"),
    new RegExp(token, "u")
  );
  const generic = genericInvestigationDiagnostic({
    code: "investigation-report.generic-test-failure",
    reason: `token=${token}\nfailed at /private/generic.md`,
    recovery: "correct the test-only failure and retry",
    target: "test target"
  });
  assert.doesNotMatch(
    renderInvestigationDiagnostic(generic).join("\n"),
    new RegExp(token, "u")
  );
  assert.doesNotMatch(
    renderInvestigationDiagnostic(generic).join("\n"),
    /\/private\/generic\.md/u
  );
});
