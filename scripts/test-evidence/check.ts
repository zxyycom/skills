import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  queryTestEvidence,
  validateTestEvidence,
  validateTestEvidenceReferences
} from "../../tools/test-evidence/src/cli.ts";
import {
  repositoryTestEvidenceSource,
  writeRepositoryTestEvidenceSnapshot,
  type RepositoryTestSnapshot
} from "./snapshot.ts";

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
): Promise<unknown> {
  try {
    return await readSnapshot(snapshotCachePath(workspaceRoot, revision));
  } catch {
    return null;
  }
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

  const outputDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "skills-test-evidence-")
  );
  const outputPath = path.join(outputDirectory, "snapshot.json");
  try {
    const expectedBefore = await repositoryTestEvidenceSource(root);
    let generatedEntityCount = 0;
    let snapshot = await readCachedSnapshot(root, expectedBefore.revision);
    let references =
      snapshot === null
        ? null
        : await validateTestEvidenceReferences({
            workspaceRoot: root,
            snapshot,
            expectedSource: expectedBefore
          });
    if (references?.status !== "ok") {
      const written = await writeRepositoryTestEvidenceSnapshot(
        root,
        outputPath,
        { expectedSource: expectedBefore }
      );
      generatedEntityCount = written.entities.length;
      snapshot = await readSnapshot(outputPath);
      references = await validateTestEvidenceReferences({
        workspaceRoot: root,
        snapshot,
        expectedSource: expectedBefore
      });
      if (references.status === "ok") {
        await publishCachedSnapshot(root, written);
      }
    }
    if (references.status !== "ok") {
      return {
        diagnostics: [
          projectDiagnostic(
            `project.references-${references.state}`,
            references.diagnostics
              .map((diagnostic) => diagnostic.message)
              .join("; ")
          )
        ],
        entityCount: generatedEntityCount,
        status: "error"
      };
    }
    const typedSnapshot = snapshot as RepositoryTestSnapshot;
    const referenced = await allReferencedTestIds(root);
    const uncovered = typedSnapshot.entities
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
        entityCount: typedSnapshot.entities.length,
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
        entityCount: typedSnapshot.entities.length,
        status: "error"
      };
    }
    return {
      diagnostics: [],
      entityCount: typedSnapshot.entities.length,
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
  } finally {
    await fs.rm(outputDirectory, { force: true, recursive: true });
  }
}

if (import.meta.main) {
  void checkRepositoryTestEvidence()
    .then((result) => {
      if (result.status === "ok") {
        process.stdout.write(
          `test evidence project check passed (${result.entityCount} entities)\n`
        );
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
