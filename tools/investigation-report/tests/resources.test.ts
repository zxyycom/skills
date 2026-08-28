import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { validateInvestigationReports } from "../src/validation.ts";
import {
  investigationResourceIdFromLinkTarget,
  investigationResourceOwnerReportId,
  isInvestigationResourceId
} from "../src/resource-reference.ts";
import {
  investigationRoot,
  withTempRoot,
  writeCollection
} from "./v6-support.ts";

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
        id: "owner-report.md",
        resources: ["owner-report/evidence(1).txt"]
      },
      {
        id: "shared-report.md",
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
      [{ id: "owner-report.md", resources: ["owner-report/missing.txt"] }],
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
      { id: "owner-report.md", resources: ["owner-report/evidence.txt"] }
    ]);
    const indexPath = path.join(
      investigationRoot(root),
      "investigation-index.json"
    );
    const before = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
      sourceRevision: unknown;
    };
    await fs.writeFile(resource, "two", "utf8");
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.deepEqual(result.errors, []);
    const after = JSON.parse(await fs.readFile(indexPath, "utf8")) as {
      sourceRevision: unknown;
    };
    assert.deepEqual(after.sourceRevision, before.sourceRevision);
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

test("attached resource section rejects unsafe local targets", async () => {
  await withTempRoot("unsafe-resource", async (root) => {
    await writeCollection(
      root,
      [{ id: "report.md", resources: ["report/../escape.txt"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.errors.length > 0);
  });
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
      [{ id: "report.md", resources: ["report/evidence.txt"] }],
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
      [{ id: "report.md", resources: ["report/link.txt"] }],
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
      [{ id: "report.md", resources: ["report/directory"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("regular file")));
  });
});

test("owner report must exist for a report-owned resource", async () => {
  await withTempRoot("missing-owner", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "owner",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "x");
    await writeCollection(
      root,
      [{ id: "consumer.md", resources: ["owner/evidence.txt"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.errors.some((error) => error.includes("owner report")));
  });
});

test("owner report must directly reference its own resource", async () => {
  await withTempRoot("owner-reference", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "owner",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "x");
    await writeCollection(
      root,
      [
        { id: "owner.md" },
        { id: "consumer.md", resources: ["owner/evidence.txt"] }
      ],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      result.errors.some((error) => error.includes("referenced by its owner"))
    );
  });
});

test("reports without attached resources remain valid", async () => {
  await withTempRoot("no-resources", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    assert.deepEqual(
      (await validateInvestigationReports({ workspaceRoot: root })).errors,
      []
    );
  });
});

test("resource references use report IDs rather than topic paths or report indexes", async () => {
  assert.equal(isInvestigationResourceId("report.md/evidence.txt"), false);
  assert.equal(isInvestigationResourceId("report/evidence.txt"), true);
  assert.equal(
    investigationResourceOwnerReportId("report/evidence.txt"),
    "report.md"
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
    await writeCollection(root, [{ id: "report.md" }]);
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
    await writeCollection(root, [{ id: "report.md" }]);
    const result = await validateInvestigationReports({
      ids: ["report.md"],
      workspaceRoot: root
    });
    assert.equal(result.indexChecked, false);
  });
});

test("resource root must be a directory when reports declare resources", async () => {
  await withTempRoot("resource-root-file", async (root) => {
    await fs.mkdir(investigationRoot(root), { recursive: true });
    await fs.writeFile(path.join(investigationRoot(root), "_resources"), "x");
    await writeCollection(
      root,
      [{ id: "report.md", resources: ["report/evidence.txt"] }],
      false
    );
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(
      result.errors.some((error) => error.includes("must be a directory"))
    );
  });
});

test("resource changes do not stale the index while report link changes do", async () => {
  await withTempRoot("resource-link-revision", async (root) => {
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "report",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "x");
    await writeCollection(root, [
      { id: "report.md", resources: ["report/evidence.txt"] }
    ]);
    await fs.writeFile(resource, "y");
    assert.deepEqual(
      (await validateInvestigationReports({ workspaceRoot: root })).errors,
      []
    );
  });
});

test("visible resource discovery rejects unsafe owner directory names", async () => {
  await withTempRoot("unsafe-owner", async (root) => {
    await writeCollection(root, [{ id: "report.md" }], false);
    const resource = path.join(
      investigationRoot(root),
      "_resources",
      "..bad",
      "evidence.txt"
    );
    await fs.mkdir(path.dirname(resource), { recursive: true });
    await fs.writeFile(resource, "x");
    const result = await validateInvestigationReports({ workspaceRoot: root });
    assert.ok(result.warnings.length > 0);
  });
});

test("resource resources are never projected as index source bytes", async () => {
  await withTempRoot("source-boundary", async (root) => {
    await writeCollection(root, [{ id: "report.md" }]);
    const index = JSON.parse(
      await fs.readFile(
        `${investigationRoot(root)}/investigation-index.json`,
        "utf8"
      )
    ) as { entries: Record<string, { state: Record<string, unknown> }> };
    assert.equal("resourceBytes" in index.entries["report.md"]!.state, false);
  });
});
