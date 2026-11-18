import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import * as v from "valibot";
import {
  queryTestEvidence,
  validateTestEvidence,
  validateTestEvidenceReferences
} from "../../tools/test-evidence/src/cli.ts";
import { snapshotSchema } from "../../tools/test-evidence/src/core-schemas.ts";
import {
  createRepositoryTestEvidenceSnapshot,
  repositoryTestEvidenceSource,
  type RepositoryTestSnapshot
} from "./snapshot/snapshot.ts";

import {
  classifyPlatformReferences,
  readPlatformEntities
} from "./platform-entities.ts";

const snapshotMaximumBytes = 67_108_864;

type CheckDiagnostic = Readonly<{
  blocking: true;
  category: "project";
  code: string;
  message: string;
}>;

function projectDiagnostic(code: string, message: string): CheckDiagnostic {
  return { blocking: true, category: "project", code, message };
}

async function readSnapshot(filePath: string): Promise<unknown> {
  const stat = await fs.lstat(filePath);
  if (
    stat.isSymbolicLink() ||
    !stat.isFile() ||
    stat.size > snapshotMaximumBytes
  ) {
    throw new Error("snapshot input is not a bounded regular file");
  }
  return JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(
      await fs.readFile(filePath)
    )
  );
}

function snapshotCachePath(workspaceRoot: string, revision: string): string {
  return path.join(
    workspaceRoot,
    ".log/vibe-check/cache/test-evidence-snapshots-v1",
    `${revision}.json`
  );
}

async function readCachedSnapshot(
  workspaceRoot: string,
  revision: string
): Promise<RepositoryTestSnapshot | null> {
  try {
    const cached = v.parse(
      snapshotSchema,
      await readSnapshot(snapshotCachePath(workspaceRoot, revision))
    );
    return cached.completeness === "complete"
      ? { ...cached, completeness: cached.completeness }
      : null;
  } catch {
    return null;
  }
}

function hasUsableInventory(
  references: Awaited<ReturnType<typeof validateTestEvidenceReferences>>
): boolean {
  // Both states mean the snapshot passed shape, source and completeness checks.
  // Missing Case references do not invalidate the inventory itself.
  return (
    references.state === "valid" || references.state === "references-invalid"
  );
}

async function publishCachedSnapshot(
  workspaceRoot: string,
  snapshot: RepositoryTestSnapshot
): Promise<void> {
  const target = snapshotCachePath(workspaceRoot, snapshot.source.revision);
  const directory = path.dirname(target);
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, {
      flag: "wx"
    });
    await fs.rename(temporary, target);
  } catch {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function allReferencedTestIds(
  workspaceRoot: string
): Promise<Set<string>> {
  const testIds = new Set<string>();
  let offset = 0;
  while (true) {
    const page = await queryTestEvidence({
      workspaceRoot,
      limit: 1000,
      offset
    });
    if (page.diagnostics.some((diagnostic) => diagnostic.blocking)) {
      throw new Error(
        page.diagnostics.map((diagnostic) => diagnostic.message).join("; ")
      );
    }
    for (const entry of page.cases) {
      for (const testId of entry.testIds) testIds.add(testId);
    }
    offset += page.cases.length;
    if (offset >= page.total) return testIds;
    if (page.cases.length === 0) {
      throw new Error("Case query stopped before its declared total");
    }
  }
}

export type RepositoryTestEvidenceCheckResult = Readonly<{
  diagnostics: readonly CheckDiagnostic[];
  entityCount: number;
  unavailableTestIds?: readonly string[];
  status: "ok" | "error";
}>;

export async function checkRepositoryTestEvidence(
  workspaceRoot: string = process.cwd()
): Promise<RepositoryTestEvidenceCheckResult> {
  const root = path.resolve(workspaceRoot);
  const catalog = await validateTestEvidence({ workspaceRoot: root });
  if (catalog.diagnostics.some((diagnostic) => diagnostic.blocking)) {
    return {
      diagnostics: [
        projectDiagnostic(
          "project.case-or-index-invalid",
          catalog.diagnostics.map((diagnostic) => diagnostic.message).join("; ")
        )
      ],
      entityCount: 0,
      status: "error"
    };
  }

  try {
    const expectedBefore = await repositoryTestEvidenceSource(root);
    const platformEntities = await readPlatformEntities(root);
    let snapshot = await readCachedSnapshot(root, expectedBefore.revision);
    let references =
      snapshot === null
        ? null
        : await validateTestEvidenceReferences({
            workspaceRoot: root,
            snapshot,
            expectedSource: expectedBefore
          });
    if (
      snapshot === null ||
      references === null ||
      !hasUsableInventory(references)
    ) {
      snapshot = await createRepositoryTestEvidenceSnapshot({
        workspaceRoot: root,
        expectedSource: expectedBefore
      });
      references = await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot,
        expectedSource: expectedBefore
      });
      if (hasUsableInventory(references)) {
        await publishCachedSnapshot(root, snapshot);
      }
    }
    const entityCount = snapshot.entities.length;
    if (!hasUsableInventory(references)) {
      return {
        diagnostics: [
          projectDiagnostic(
            `project.references-${references.state}`,
            references.diagnostics
              .map((diagnostic) => diagnostic.message)
              .join("; ")
          )
        ],
        entityCount,
        status: "error"
      };
    }
    const missing =
      references.state === "references-invalid"
        ? references.diagnostics.map((diagnostic) => diagnostic.testId ?? "")
        : [];
    const classified = classifyPlatformReferences(
      platformEntities,
      process.platform,
      new Set(snapshot.entities.map((entity) => entity.id)),
      missing
    );
    const diagnostics: CheckDiagnostic[] = [];
    if (classified.invalid.length) {
      diagnostics.push(
        projectDiagnostic(
          "project.references-references-invalid",
          references.diagnostics
            .filter(
              (diagnostic) =>
                !classified.unavailable.includes(diagnostic.testId ?? "")
            )
            .map((diagnostic) => diagnostic.message)
            .join("; ")
        )
      );
    }
    if (classified.stale.length || classified.unexpected.length) {
      diagnostics.push(
        projectDiagnostic(
          "project.platform-declaration-invalid",
          [
            ...classified.unexpected.map(
              ({ locator }) =>
                `foreign platform entity unexpectedly present: ${locator}`
            ),
            ...classified.stale.map(
              ({ locator }) =>
                `declared local platform entity missing: ${locator}`
            )
          ].join("; ")
        )
      );
    }
    if (diagnostics.length) {
      return {
        diagnostics,
        entityCount,
        status: "error"
      };
    }
    const referenced = await allReferencedTestIds(root);
    const uncovered = snapshot.entities
      .map((entity) => entity.id)
      .filter((id) => !referenced.has(id));
    if (uncovered.length > 0) {
      return {
        diagnostics: [
          projectDiagnostic(
            "project.entity-without-case",
            `repository test entities require a Case: ${uncovered.join(", ")}`
          )
        ],
        entityCount,
        status: "error"
      };
    }
    const expectedAfterCheck = await repositoryTestEvidenceSource(root);
    if (expectedBefore.revision !== expectedAfterCheck.revision) {
      return {
        diagnostics: [
          projectDiagnostic(
            "project.source-drift",
            "repository source inputs changed while checking Case coverage"
          )
        ],
        entityCount,
        status: "error"
      };
    }
    return {
      diagnostics: [],
      entityCount,
      ...(classified.unavailable.length
        ? { unavailableTestIds: classified.unavailable }
        : {}),
      status: "ok"
    };
  } catch (error) {
    return {
      diagnostics: [
        projectDiagnostic(
          "project.snapshot-failed",
          error instanceof Error ? error.message : String(error)
        )
      ],
      entityCount: 0,
      status: "error"
    };
  }
}

if (import.meta.main) {
  void checkRepositoryTestEvidence()
    .then((result) => {
      if (result.status === "ok") {
        process.stdout.write(
          `test evidence project check passed (${result.entityCount} local entities; ${result.unavailableTestIds?.length ?? 0} platform-unavailable references; tests not executed)\n`
        );
        for (const id of result.unavailableTestIds ?? [])
          process.stdout.write(`platform unavailable: ${id}\n`);
        return;
      }
      for (const diagnostic of result.diagnostics) {
        process.stderr.write(`${diagnostic.code}: ${diagnostic.message}\n`);
      }
      process.exitCode = 1;
    })
    .catch((error: unknown) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`
      );
      process.exitCode = 1;
    });
}
