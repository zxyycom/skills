import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import path from "node:path";
import { runInvestigationReportCheckCli } from "../src/cli.ts";
import { prepareInvestigationResourceRoot } from "../src/resource-root.ts";
import {
  directInvestigationResourceIssues,
  inspectDirectInvestigationResource
} from "../src/resource-file-validation.ts";
import {
  initializeGit,
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

const resourceId = "one/nested/member.txt";
async function prepare(root: string, recorded = true): Promise<void> {
  const target = path.join(investigationRoot(root), "_resources", resourceId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "original\n");
  await writeCollection(root, [{ id: "one" }]);
  if (recorded) initializeGit(root);
  await fs.writeFile(target, "selected update\n");
}

function denied(): Error {
  return Object.assign(
    new Error(
      "denied /private/resource\n\u001b[31m token=ghp_123456789012345678901234567890"
    ),
    { code: "EACCES" }
  );
}
function targetFor(root: string, failure: string): string {
  const resources = path.join(investigationRoot(root), "_resources");
  if (failure.startsWith("root")) return resources;
  if (failure.startsWith("owner")) return path.join(resources, "one");
  if (failure.startsWith("intermediate"))
    return path.join(resources, "one/nested");
  return path.join(resources, resourceId);
}
function operationFor(failure: string): string {
  if (failure.endsWith("enumeration")) return "read resource directory";
  if (failure.endsWith("resolution")) return "resolve resource root";
  if (failure === "terminal open") return "open resource file";
  return "inspect resource path";
}

/** Faults start only after the first complete source phase consumed its report. */
function injectSecondPhaseFailure(
  root: string,
  failure: string,
  error: Error
): Readonly<{
  injected: () => boolean;
  restore: () => void;
}> {
  const target = targetFor(root, failure);
  const source = path.join(investigationRoot(root), "one.md");
  const readFile = fs.readFile;
  let sourceReads = 0,
    injected = false;
  fs.readFile = (async (...args: Parameters<typeof fs.readFile>) => {
    const result = await readFile(...args);
    if (args[0] === source) sourceReads += 1;
    return result;
  }) as typeof fs.readFile;
  const fail = (candidate: unknown): void => {
    if (candidate === target && sourceReads === 1 && !injected) {
      injected = true;
      throw error;
    }
  };
  let restoreOperation: () => void;
  if (failure.endsWith("enumeration")) {
    const original = fs.readdir;
    fs.readdir = (async (...args: Parameters<typeof fs.readdir>) => {
      fail(args[0]);
      return await original(...args);
    }) as typeof fs.readdir;
    restoreOperation = () => {
      fs.readdir = original;
    };
  } else if (failure.endsWith("resolution")) {
    const original = fs.realpath;
    fs.realpath = (async (...args: Parameters<typeof fs.realpath>) => {
      fail(args[0]);
      return await original(...args);
    }) as typeof fs.realpath;
    restoreOperation = () => {
      fs.realpath = original;
    };
  } else if (failure === "terminal open") {
    const original = fs.open;
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      fail(args[0]);
      return await original(...args);
    }) as typeof fs.open;
    restoreOperation = () => {
      fs.open = original;
    };
  } else {
    const original = fs.lstat;
    fs.lstat = (async (...args: Parameters<typeof fs.lstat>) => {
      fail(args[0]);
      return await original(...args);
    }) as typeof fs.lstat;
    restoreOperation = () => {
      fs.lstat = original;
    };
  }
  return {
    injected: () => injected,
    restore: () => {
      fs.readFile = readFile;
      restoreOperation();
    }
  };
}

async function expectStageReadFailure(
  root: string,
  facts: Readonly<{
    failure: string;
    error: Error;
    category: "access-denied" | "unknown";
    recovery: string;
  }>
): Promise<void> {
  await prepare(root);
  const indexPath = path.join(root, ".git/index");
  const before = await fs.readFile(indexPath);
  const fault = injectSecondPhaseFailure(root, facts.failure, facts.error);
  let stdout = "",
    stderr = "";
  try {
    const exit = await runInvestigationReportCheckCli(
      ["--root", root, "stage", "one", "--scope", "domain"],
      {
        io: {
          stdout: (value) => {
            stdout += value;
          },
          stderr: (value) => {
            stderr += value;
          }
        }
      }
    );
    assert.equal(fault.injected(), true);
    assert.equal(exit, 1);
    assert.equal(stdout, "");
    assert.match(stderr, /state: source-drift; changed: false/u);
    assert.ok(stderr.includes(`causeCategory: ${facts.category}`));
    assert.ok(stderr.includes(`operation: ${operationFor(facts.failure)}`));
    const relative = path
      .relative(root, targetFor(root, facts.failure))
      .split(path.sep)
      .join("/");
    assert.ok(
      stderr.includes(
        `[investigation-report.stage-source-read-failed] ${relative}\n`
      )
    );
    assert.ok(stderr.includes(facts.recovery));
    assert.ok(!stderr.includes(String.fromCharCode(27)));
    assert.ok(!/private|ghp_|sync-index|scope: Pending/u.test(stderr));
    assert.deepEqual(await fs.readFile(indexPath), before);
  } finally {
    fault.restore();
  }
}

for (const failure of [
  "root inspection",
  "root resolution",
  "root enumeration",
  "owner enumeration",
  "intermediate enumeration",
  "file inspection",
  "terminal open"
]) {
  test(`investigation stage preserves second-phase resource ${failure} failure facts without mutation`, async () => {
    await withTempRoot("resource-failure-facts", async (root) => {
      await expectStageReadFailure(root, {
        failure,
        error: denied(),
        category: "access-denied",
        recovery: "restore access required"
      });
    });
  });
}

test("resource inspectors keep default validation issues while detailed inspection retains real open failure", async () => {
  await withTempRoot("resource-default-issues", async (root) => {
    await prepare(root, false);
    const prepared = await prepareInvestigationResourceRoot(
      investigationRoot(root)
    );
    assert.equal(prepared.status, "ready");
    if (prepared.status !== "ready") return;
    const original = fs.open;
    const target = targetFor(root, "terminal open");
    fs.open = (async (...args: Parameters<typeof fs.open>) => {
      if (args[0] === target) throw denied();
      return await original(...args);
    }) as typeof fs.open;
    try {
      const issues = await directInvestigationResourceIssues(
        prepared,
        resourceId
      );
      const detailed = await inspectDirectInvestigationResource(
        prepared,
        resourceId
      );
      assert.deepEqual(detailed.errors, issues);
      assert.match(issues.join("; "), /could not be read as a regular file/u);
      assert.equal(detailed.failure?.diagnostic.causeCategory, "access-denied");
      assert.equal(
        detailed.failure?.diagnostic.operation,
        "open resource file"
      );
      assert.equal(detailed.failure?.diagnostic.target, target);
      assert.ok(!/private|ghp_/u.test(issues.join("; ")));
      assert.ok(!issues.join("; ").includes(String.fromCharCode(27)));
    } finally {
      fs.open = original;
    }
  });
});

test("resource inspectors do not invent filesystem categories for ordinary symlink validation", async () => {
  await withTempRoot("resource-validation-not-system", async (root) => {
    await prepare(root, false);
    const target = targetFor(root, "terminal open");
    const saved = path.join(root, "saved-resource");
    await fs.rename(target, saved);
    await fs.symlink(saved, target);
    const prepared = await prepareInvestigationResourceRoot(
      investigationRoot(root)
    );
    assert.equal(prepared.status, "ready");
    if (prepared.status !== "ready") return;
    const inspected = await inspectDirectInvestigationResource(
      prepared,
      resourceId
    );
    assert.equal(inspected.failure, undefined);
    assert.match(inspected.errors.join("; "), /symbolic link/u);
    assert.deepEqual(
      await directInvestigationResourceIssues(prepared, resourceId),
      inspected.errors
    );
  });
});

test("investigation stage keeps unknown real resource syscall failures distinct from ordinary validation", async () => {
  await withTempRoot("resource-unknown-failure", async (root) => {
    await expectStageReadFailure(root, {
      failure: "terminal open",
      error: Object.assign(
        new Error("unsupported /private/resource token=private-value"),
        { code: "ENOTSUP" }
      ),
      category: "unknown",
      recovery: "resolve the reported filesystem read failure"
    });
  });
});
