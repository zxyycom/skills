import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { parseInvestigationReport } from "../src/markdown.ts";
import { buildInvestigationReportState } from "../src/report-validation.ts";
import { validateInvestigationResourceOwnership } from "../src/resources.ts";
import { reportMarkdown } from "./fixture-support.ts";
import { validateInvestigationReports } from "../src/validation.ts";
import {
  investigationResourceIdFromLinkTarget,
  investigationResourceOwnerReportId,
  isInvestigationResourceId
} from "../src/resource-reference.ts";
import {
  investigationRoot,
  parseJsonObject,
  withTempRoot
} from "./fixture-support.ts";
import { writeCollection } from "./collection-support.ts";

test("report-owned resources validate exact links and permit shared references", async () => {
  await withTempRoot("resources", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "owner-report",
      "evidence(1).txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "evidence", "utf8");
    await writeCollection(root, [
      {
        id: "owner-report",
        resources: ["owner-report/evidence(1).txt"]
      },
      {
        id: "shared-report",
        resources: ["owner-report/evidence(1).txt"]
      }
    ]);
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.deepEqual(result.errors, []);
  });
});

test("referenced missing resources are errors and unreferenced visible resources are warnings", async () => {
  await withTempRoot("resource-diagnostics", async (root) => {
    await writeCollection(
      root,
      [{ id: "owner-report", resources: ["owner-report/missing.txt"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("does not exist")));
    await fs.mkdir(
      path.join(investigationRoot(root), "_resources", "unused-report"),
      { recursive: true }
    );
    await fs.writeFile(
      path.join(
        investigationRoot(root),
        "_resources",
        "unused-report",
        "unused.txt"
      ),
      "unused",
      "utf8"
    );
    const warning = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(warning.warnings.length > 0);
  });
});

test("resource byte changes do not change the report index source revision", async () => {
  await withTempRoot("resource-revision", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "owner-report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "one", "utf8");
    await writeCollection(root, [
      { id: "owner-report", resources: ["owner-report/evidence.txt"] }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    await fs.writeFile(resource, "two", "utf8");
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.deepEqual(result.errors, []);
    const after = parseJsonObject(await fs.readFile(indexPath, "utf8"));
    assert.deepEqual(after["sourceRevision"], before["sourceRevision"]);
  });
});

test("resource ID whitelist accepts report-owned names and rejects structural hazards", () => {
  assert.equal(isInvestigationResourceId("owner-report/evidence.txt"), true);
  assert.equal(
    isInvestigationResourceId("owner-report/../evidence.txt"),
    false
  );
  assert.equal(
    investigationResourceIdFromLinkTarget(
      "../_resources/owner-report/evidence.txt"
    ).status,
    "invalid"
  );
});

test("attached resource section rejects unsafe local targets", () => {
  const parsed = parseInvestigationReport(
    reportMarkdown({ id: "report", resources: ["report/../escape.txt"] }),
    "report"
  );
  assert.ok(
    parsed.resourceErrors.some((error) =>
      error.includes("safe, normalized resource id")
    )
  );
  assert.deepEqual(parsed.report?.resourceIds, []);
});

test("attached resource links reject path casing mismatches", async () => {
  await withTempRoot("resource-case", async (root) => {
    const directory = path.join(
      investigationRoot(root),
      "_resources",
      "report"
    );
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "Evidence.txt"), "x");
    await writeCollection(
      root,
      [{ id: "report", resources: ["report/evidence.txt"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("casing")));
  });
});

test("attached resources reject symbolic link targets", async () => {
  await withTempRoot("resource-link", async (root) => {
    const directory = path.join(
      investigationRoot(root),
      "_resources",
      "report"
    );
    await fs.mkdir(directory, { recursive: true });
    await fs.symlink("/tmp", path.join(directory, "link.txt"));
    await writeCollection(
      root,
      [{ id: "report", resources: ["report/link.txt"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("symbolic")));
  });
});

test("attached resource targets must be regular files", async () => {
  await withTempRoot("resource-directory", async (root) => {
    await fs.mkdir(
      path.join(investigationRoot(root), "_resources", "report", "directory"),
      { recursive: true }
    );
    await writeCollection(
      root,
      [{ id: "report", resources: ["report/directory"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("regular file")));
  });
});

test("owner report must exist for a report-owned resource", () => {
  const errors = validateInvestigationResourceOwnership(
    ["owner/evidence.txt"],
    new Map([["consumer", new Set(["owner/evidence.txt"])]])
  );
  assert.deepEqual(errors, [
    "_resources/owner/evidence.txt owner report owner does not exist"
  ]);
});

test("owner report must directly reference its own resource", () => {
  const errors = validateInvestigationResourceOwnership(
    ["owner/evidence.txt"],
    new Map([
      ["owner", new Set<string>()],
      ["consumer", new Set(["owner/evidence.txt"])]
    ])
  );
  assert.deepEqual(errors, [
    "_resources/owner/evidence.txt must be referenced by its owner report owner"
  ]);
});

test("reports without attached resources remain valid", () => {
  const parsed = parseInvestigationReport(
    reportMarkdown({ id: "report" }),
    "report"
  );
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.report?.resourceIds, []);
});

test("resource references use report IDs rather than topic paths or report indexes", async () => {
  assert.equal(isInvestigationResourceId("report.md/evidence.txt"), false);
  assert.equal(isInvestigationResourceId("report/evidence.txt"), true);
  assert.equal(
    investigationResourceOwnerReportId("report/evidence.txt"),
    "report"
  );
});

test("resource links require literal current relative targets", () => {
  assert.equal(
    investigationResourceIdFromLinkTarget("./_resources/report/evidence.txt")
      .status,
    "valid"
  );
  assert.equal(
    investigationResourceIdFromLinkTarget("./_resources/report/evidence(1).txt")
      .status,
    "valid"
  );
  assert.equal(
    investigationResourceIdFromLinkTarget(
      "./_resources/report/evidence.txt#fragment"
    ).status,
    "invalid"
  );
});

test("unreferenced resource members produce warnings without blocking report checks", async () => {
  await withTempRoot("unreferenced", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "unused",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "x");
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.deepEqual(result.errors, []);
    assert.ok(result.warnings.length > 0);
  });
});

test("scoped resource checks do not claim global unreferenced resource proof", async () => {
  await withTempRoot("scoped-resource", async (root) => {
    await writeCollection(root, [{ id: "report" }]);
    const unrelated = path.join(
      investigationRoot(root),
      "_resources",
      "unused",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(unrelated), { recursive: true });
    await fs.writeFile(unrelated, "unused");
    const result = await validateInvestigationReports({
      ids: ["report.md"],
      workspaceRoot: root
    });
    assert.equal(result.indexChecked, false);
    assert.ok(
      !result.warnings.some((warning) =>
        warning.includes("unused/evidence.txt")
      )
    );
    const full = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      full.warnings.some((warning) => warning.includes("unused/evidence.txt"))
    );
  });
});

test("resource root must be a directory when reports declare resources", async () => {
  await withTempRoot("resource-root-file", async (root) => {
    await fs.mkdir(investigationRoot(root), { recursive: true });
    await fs.writeFile(path.join(investigationRoot(root), "_resources"), "x");
    await writeCollection(
      root,
      [{ id: "report", resources: ["report/evidence.txt"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      result.errors.some((error) => error.includes("must be a directory"))
    );
  });
});

test("report resource link changes stale the current index", async () => {
  await withTempRoot("resource-link-revision", async (root) => {
    const resourceDirectory = path.join(
      investigationRoot(root),
      "_resources",
      "report"
    );
    await fs.mkdir(resourceDirectory, { recursive: true });
    await fs.writeFile(path.join(resourceDirectory, "evidence.txt"), "x");
    await fs.writeFile(path.join(resourceDirectory, "replacement.txt"), "y");
    await writeCollection(root, [
      { id: "report", resources: ["report/evidence.txt"] }
    ]);
    const reportPath = path.join(investigationRoot(root), "report.md");
    await fs.writeFile(
      reportPath,
      (await fs.readFile(reportPath, "utf8")).replace(
        "report/evidence.txt",
        "report/replacement.txt"
      ),
      "utf8"
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      result.errors.some(
        (error) => error.includes("source") || error.includes("index")
      )
    );
  });
});

test("visible resource discovery rejects unsafe owner directory names", async () => {
  await withTempRoot("unsafe-owner", async (root) => {
    await writeCollection(root, [{ id: "report" }], false);
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "..bad",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "x");
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      result.warnings.some(
        (warning) => warning.includes("..bad") && warning.includes("safe")
      )
    );
  });
});

test("resource resources are never projected as index source bytes", () => {
  const built = buildInvestigationReportState(
    "report",
    parseInvestigationReport(
      reportMarkdown({ id: "report", resources: ["report/evidence.txt"] }),
      "report"
    ),
    "report.md"
  );
  assert.equal(built.status, "valid");
  assert.deepEqual(built.state.resourceIds, ["report/evidence.txt"]);
  assert.equal("resourceBytes" in built.state, false);
});
