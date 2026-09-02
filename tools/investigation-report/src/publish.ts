import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  InvestigationCollectionMutationLockError,
  withInvestigationCollectionMutationLock
} from "./collection-mutation-lock.ts";
import {
  diagnosticFromError,
  sanitizeInvestigationDiagnosticText,
  type InvestigationDiagnostic,
  type InvestigationMutationDiagnostic
} from "./diagnostics.ts";
import { parseInvestigationCandidatePublishOptions } from "./options.ts";
import {
  prepareInvestigationPublish,
  resourceSnapshotStillCurrent,
  type InvestigationPublishPreparation
} from "./publish-preparation.ts";
import {
  canonicalizeInvestigationsDirectory,
  investigationIndexFileName,
  isInvestigationId,
  resolveInvestigationsDirectory
} from "./report-path.ts";
import type {
  InvestigationCandidatePublishOptions,
  InvestigationCandidatePublishResult
} from "./types.ts";

export type InvestigationPublishWriter = (
  indexPath: string,
  indexText: string,
  indexExisted: boolean
) => Promise<void | InvestigationPublishWriteResult>;
type InvestigationPublishWriteResult = Readonly<{ warnings: string[] }>;
type BeforeInvestigationPublish = () => Promise<void>;
type PublishWithinLockOptions = Readonly<{
  beforePublish: BeforeInvestigationPublish;
  ids: readonly string[];
  indexPath: string;
  root: string;
  write: InvestigationPublishWriter;
}>;
type InitialPublishPreparation = Readonly<{
  originalIndexText: string | null;
  preparation: InvestigationPublishPreparation;
  status: "ready";
}>;

export async function publishInvestigationCandidates(
  input: unknown
): Promise<InvestigationCandidatePublishResult> {
  return await publishInvestigationCandidatesWithWriter(
    input,
    writeIndexAtomically
  );
}

export async function publishInvestigationCandidatesWithWriter(
  input: unknown,
  write: InvestigationPublishWriter,
  beforePublish: BeforeInvestigationPublish = async () => {}
): Promise<InvestigationCandidatePublishResult> {
  const parsed = parseInvestigationCandidatePublishOptions(input);
  if (parsed.isErr()) return invalidResult(input, parsed.error);
  const options = parsed.value;
  const validated = validateOptions(options);
  if (validated.errors.length > 0)
    return result(options, false, validated.errors);
  const resolved = resolveInvestigationsDirectory(
    options.workspaceRoot,
    options.investigationsDir
  );
  if (resolved.isErr()) return result(options, false, resolved.error);
  const canonical = await canonicalizeInvestigationsDirectory(resolved.value);
  if (canonical.isErr()) return result(options, false, canonical.error);
  const root = canonical.value.investigationsDirectory;
  const indexPath = path.join(root, investigationIndexFileName);

  if (options.preflight === true) {
    const prepared = await prepareInvestigationPublish(root, options.ids);
    return prepared.status === "ok"
      ? result(options, false, [], {
          indexPath,
          warnings: prepared.warnings
        })
      : result(options, false, prepared.errors, {
          diagnostics: prepared.diagnostics,
          indexPath,
          warnings: prepared.warnings
        });
  }

  try {
    return await withInvestigationCollectionMutationLock(indexPath, async () =>
      publishWithinLock({
        beforePublish,
        ids: options.ids,
        indexPath,
        root,
        write
      })
    );
  } catch (error) {
    return publishLockFailure(options, indexPath, error);
  }
}

async function publishWithinLock(
  options: PublishWithinLockOptions
): Promise<InvestigationCandidatePublishResult> {
  const initial = await initialPublishPreparation(options);
  if ("errors" in initial) return initial;
  try {
    await options.beforePublish();
  } catch (error) {
    return publishNoChangeFailure(
      options,
      initial.preparation,
      "investigation-report.publish-before-write-failed",
      error
    );
  }
  return await publishProtectedPreparation(options, initial);
}

async function initialPublishPreparation(
  options: PublishWithinLockOptions
): Promise<InitialPublishPreparation | InvestigationCandidatePublishResult> {
  const first = await prepareInvestigationPublish(options.root, options.ids);
  if (first.status === "error") {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      first.errors,
      {
        diagnostics: first.diagnostics,
        indexPath: options.indexPath,
        warnings: first.warnings,
        mutation: publishMutation("no-change")
      }
    );
  }
  const originalIndex = await currentIndexText(
    options.indexPath,
    first.value.indexExisted
  );
  if (originalIndex.status === "error") {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      originalIndex.errors,
      {
        diagnostics: originalIndex.diagnostics,
        indexPath: options.indexPath,
        warnings: first.warnings,
        mutation: publishMutation("no-change")
      }
    );
  }
  return {
    originalIndexText: originalIndex.value,
    preparation: first.value,
    status: "ready"
  };
}

async function publishProtectedPreparation(
  options: PublishWithinLockOptions,
  initial: InitialPublishPreparation
): Promise<InvestigationCandidatePublishResult> {
  const protectedPreparation = await prepareInvestigationPublish(
    options.root,
    options.ids
  );
  if (protectedPreparation.status === "error") {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      [
        "investigation publish preparation changed before any files were written",
        ...protectedPreparation.errors
      ],
      {
        diagnostics: protectedPreparation.diagnostics,
        indexPath: options.indexPath,
        warnings: protectedPreparation.warnings,
        mutation: publishMutation("no-change")
      }
    );
  }
  const drift = await preparationDrift(
    options.root,
    initial.preparation,
    protectedPreparation.value,
    initial.originalIndexText
  );
  if (drift.length > 0) {
    return result(
      { ids: options.ids, workspaceRoot: options.root },
      false,
      drift,
      {
        indexPath: options.indexPath,
        warnings: protectedPreparation.warnings,
        mutation: publishMutation("no-change")
      }
    );
  }

  return await publishPreparedCollection({
    indexText: protectedPreparation.value.nextIndexText,
    originalIndexText: initial.originalIndexText,
    preparation: protectedPreparation.value,
    root: options.root,
    write: options.write
  });
}

async function publishPreparedCollection(options: {
  indexText: string;
  originalIndexText: string | null;
  preparation: InvestigationPublishPreparation;
  root: string;
  write: InvestigationPublishWriter;
}): Promise<InvestigationCandidatePublishResult> {
  const moved: Array<Readonly<{ candidatePath: string; formalPath: string }>> =
    [];
  try {
    for (const source of options.preparation.candidateSources) {
      const candidatePath = options.preparation.candidatePaths.get(source.id)!;
      const formalPath = path.join(options.root, source.id);
      await fs.link(candidatePath, formalPath);
      moved.push({ candidatePath, formalPath });
      await fs.unlink(candidatePath);
    }
    const written = await options.write(
      options.preparation.indexPath,
      options.indexText,
      options.preparation.indexExisted
    );
    return result(
      {
        ids: options.preparation.candidateSources.map((source) => source.id),
        workspaceRoot: options.root
      },
      true,
      [],
      {
        indexPath: options.preparation.indexPath,
        warnings: [
          ...options.preparation.warnings,
          ...(written?.warnings ?? [])
        ]
      }
    );
  } catch (error) {
    const restored = await restorePreparedPublication({
      moved,
      originalIndexText: options.originalIndexText,
      preparation: options.preparation,
      write: options.write
    });
    const outcome =
      restored.length === 0 ? "rolled-back" : "partial-or-unknown";
    return result(
      {
        ids: options.preparation.candidateSources.map((source) => source.id),
        workspaceRoot: options.root
      },
      false,
      [
        "investigation publish failed before the derived index commit point",
        ...restored
      ],
      {
        diagnostics: [
          diagnosticFromError({
            code: "investigation-report.publish-failed",
            error,
            mutation: publishMutation(outcome),
            reason:
              "the selected candidates could not be published before the derived index commit point",
            recovery:
              restored.length === 0
                ? "correct the reported failure, then retry publish from the current collection state"
                : "stop mutations and reconcile the candidate, formal report, and index paths before retrying",
            target: options.preparation.indexPath
          })
        ],
        indexPath: options.preparation.indexPath,
        warnings: options.preparation.warnings,
        mutation: publishMutation(outcome)
      }
    );
  }
}

async function restorePreparedPublication(options: {
  moved: readonly Readonly<{ candidatePath: string; formalPath: string }>[];
  originalIndexText: string | null;
  preparation: InvestigationPublishPreparation;
  write: InvestigationPublishWriter;
}): Promise<string[]> {
  const errors: string[] = [];
  for (const moved of [...options.moved].reverse()) {
    try {
      if (
        (await pathExists(moved.formalPath)) &&
        !(await pathExists(moved.candidatePath))
      ) {
        await fs.link(moved.formalPath, moved.candidatePath);
      }
      await fs.rm(moved.formalPath, { force: true });
    } catch {
      errors.push(
        `failed to restore candidate ${path.basename(moved.candidatePath)}`
      );
    }
  }
  try {
    if (options.originalIndexText === null) {
      await fs.rm(options.preparation.indexPath, { force: true });
    } else {
      await options.write(
        options.preparation.indexPath,
        options.originalIndexText,
        true
      );
    }
  } catch {
    errors.push("failed to restore the investigation index");
  }
  return uniqueSorted(errors);
}

async function preparationDrift(
  root: string,
  first: InvestigationPublishPreparation,
  protectedPreparation: InvestigationPublishPreparation,
  originalIndexText: string | null
): Promise<string[]> {
  if (!sameSources(first.formalSources, protectedPreparation.formalSources)) {
    return [
      "formal investigation sources changed after publish preparation; no files were written"
    ];
  }
  if (
    !sameSources(first.candidateSources, protectedPreparation.candidateSources)
  ) {
    return [
      "selected investigation candidates changed after publish preparation; no files were written"
    ];
  }
  const current = await currentIndexText(
    protectedPreparation.indexPath,
    protectedPreparation.indexExisted
  );
  if (current.status === "error") return current.errors;
  if (current.value !== originalIndexText) {
    return [
      "investigation index changed after publish preparation; no files were written"
    ];
  }
  if (
    !sameResourceSnapshots(
      first.resourceSnapshot,
      protectedPreparation.resourceSnapshot
    )
  ) {
    return [
      "selected candidate resources changed identity after publish preparation; no files were written"
    ];
  }
  return await resourceSnapshotStillCurrent(
    root,
    protectedPreparation.resourceSnapshot
  );
}

async function currentIndexText(
  indexPath: string,
  expected: boolean
): Promise<
  | Readonly<{ status: "ok"; value: string | null }>
  | Readonly<{
      diagnostics: InvestigationDiagnostic[];
      errors: string[];
      status: "error";
    }>
> {
  try {
    const entry = await fs.lstat(indexPath);
    if (entry.isSymbolicLink() || !entry.isFile()) {
      return {
        diagnostics: [],
        errors: [
          "investigation index must be a regular non-symbolic-link file"
        ],
        status: "error"
      };
    }
    if (!expected) {
      return {
        diagnostics: [],
        errors: ["investigation index appeared after publish preparation"],
        status: "error"
      };
    }
    return { status: "ok", value: await fs.readFile(indexPath, "utf8") };
  } catch (error) {
    if (isMissing(error) && !expected) return { status: "ok", value: null };
    return {
      diagnostics: [
        diagnosticFromError({
          code: "investigation-report.publish-index-read-failed",
          error,
          reason: "the investigation index could not be read before publish",
          recovery:
            "restore a readable current index or run sync-index before retrying publish",
          target: indexPath
        })
      ],
      errors: ["investigation index could not be read before publish"],
      status: "error"
    };
  }
}

async function writeIndexAtomically(
  indexPath: string,
  indexText: string,
  indexExisted: boolean
): Promise<InvestigationPublishWriteResult> {
  await validateIndexPublicationTarget(indexPath, indexExisted);
  const investigationDirectory = path.dirname(indexPath);
  const stagingDirectory = path.dirname(investigationDirectory);
  const temporaryPath = path.join(
    stagingDirectory,
    `.${path.basename(indexPath)}.${process.pid}.${randomUUID()}.publish`
  );
  let published = false;
  try {
    await validateIndexStagingFilesystem(
      investigationDirectory,
      stagingDirectory
    );
    await writeTemporaryIndex(temporaryPath, indexText);
    const result = await publishTemporaryIndex(
      temporaryPath,
      indexPath,
      indexExisted
    );
    published = true;
    return result;
  } finally {
    if (!published) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

async function validateIndexPublicationTarget(
  indexPath: string,
  indexExisted: boolean
): Promise<void> {
  if (!indexExisted) return;
  const existing = await fs.lstat(indexPath);
  if (existing.isSymbolicLink() || !existing.isFile()) {
    throw new Error(
      "investigation index must be a regular non-symbolic-link file"
    );
  }
}

async function validateIndexStagingFilesystem(
  investigationDirectory: string,
  stagingDirectory: string
): Promise<void> {
  const [investigationStats, stagingStats] = await Promise.all([
    fs.stat(investigationDirectory),
    fs.stat(stagingDirectory)
  ]);
  if (investigationStats.dev !== stagingStats.dev) {
    throw new Error(
      "index staging directory is not on the investigation collection filesystem"
    );
  }
}

async function writeTemporaryIndex(
  temporaryPath: string,
  indexText: string
): Promise<void> {
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(indexText, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function publishTemporaryIndex(
  temporaryPath: string,
  indexPath: string,
  indexExisted: boolean
): Promise<InvestigationPublishWriteResult> {
  if (indexExisted) {
    await fs.rename(temporaryPath, indexPath);
    return { warnings: [] };
  }
  await fs.link(temporaryPath, indexPath);
  try {
    await fs.rm(temporaryPath, { force: true });
    return { warnings: [] };
  } catch (error) {
    return {
      warnings: [
        `investigation index was published but its temporary publication file could not be removed: ${sanitizeInvestigationDiagnosticText(error)}`
      ]
    };
  }
}

function publishNoChangeFailure(
  options: { ids: readonly string[]; indexPath: string; root: string },
  preparation: InvestigationPublishPreparation,
  code: string,
  error: unknown
): InvestigationCandidatePublishResult {
  return result(
    { ids: options.ids, workspaceRoot: options.root },
    false,
    ["investigation publish could not continue before writing files"],
    {
      diagnostics: [
        diagnosticFromError({
          code,
          error,
          mutation: publishMutation("no-change"),
          reason:
            "the publish transaction stopped before changing candidate or formal report paths",
          recovery:
            "resolve the reported failure, then retry publish from the current collection state",
          target: options.indexPath
        })
      ],
      indexPath: options.indexPath,
      warnings: preparation.warnings,
      mutation: publishMutation("no-change")
    }
  );
}

function publishLockFailure(
  input: InvestigationCandidatePublishOptions,
  indexPath: string,
  error: unknown
): InvestigationCandidatePublishResult {
  if (
    error instanceof InvestigationCollectionMutationLockError &&
    error.operationCompleted &&
    isPublishResult(error.operationResult)
  ) {
    const completed = error.operationResult;
    const mutation = publishMutation(
      completed.changed ? "committed-cleanup-pending" : "no-change"
    );
    return {
      ...completed,
      diagnostics: [
        ...completed.diagnostics,
        { ...error.diagnostic, mutation }
      ],
      errors: uniqueSorted([
        ...completed.errors,
        sanitizeInvestigationDiagnosticText(error)
      ]),
      mutation
    };
  }
  const releaseFailure =
    error instanceof InvestigationCollectionMutationLockError &&
    error.diagnostic.code ===
      "investigation-report.collection-lock-release-failed";
  const mutation = publishMutation(
    releaseFailure ? "partial-or-unknown" : "no-change"
  );
  const diagnostic =
    error instanceof InvestigationCollectionMutationLockError
      ? { ...error.diagnostic, mutation }
      : diagnosticFromError({
          code: "investigation-report.publish-transaction-failed",
          error,
          mutation,
          reason: "the publish transaction stopped unexpectedly",
          recovery:
            "verify selected candidates, formal reports, resources, and the index before retrying publish",
          target: indexPath
        });
  return result(
    input,
    false,
    ["investigation publish could not be completed"],
    {
      diagnostics: [diagnostic],
      indexPath,
      mutation
    }
  );
}

function validateOptions(input: InvestigationCandidatePublishOptions): {
  errors: string[];
} {
  const errors: string[] = [];
  if (!Array.isArray(input.ids)) errors.push("publish ids must be an array");
  if (!input.ids.every((id) => isInvestigationId(id))) {
    errors.push("publish IDs must use Investigation IDs");
  }
  if (input.ids.length === 0)
    errors.push("publish requires at least one Investigation ID");
  if (new Set(input.ids).size !== input.ids.length)
    errors.push("publish IDs must not repeat");
  return { errors: uniqueSorted(errors) };
}

function invalidResult(
  input: unknown,
  errors: readonly string[]
): InvestigationCandidatePublishResult {
  const workspaceRoot =
    typeof input === "object" &&
    input !== null &&
    typeof Reflect.get(input, "workspaceRoot") === "string"
      ? (Reflect.get(input, "workspaceRoot") as string)
      : ".";
  return result({ ids: [], workspaceRoot }, false, errors);
}

function result(
  input: Pick<
    InvestigationCandidatePublishOptions,
    "ids" | "preflight" | "workspaceRoot"
  >,
  changed: boolean,
  errors: readonly string[],
  options: Readonly<{
    diagnostics?: readonly InvestigationDiagnostic[];
    indexPath?: string;
    mutation?: InvestigationMutationDiagnostic;
    warnings?: readonly string[];
  }> = {}
): InvestigationCandidatePublishResult {
  return {
    changed,
    diagnostics: [...(options.diagnostics ?? [])],
    errors: uniqueSorted(errors),
    ids: [...input.ids].sort(compareText),
    indexPath:
      options.indexPath ??
      path.resolve(
        input.workspaceRoot,
        "docs/investigations",
        investigationIndexFileName
      ),
    ...(options.mutation === undefined ? {} : { mutation: options.mutation }),
    preflight: input.preflight === true,
    warnings: uniqueSorted(options.warnings ?? [])
  };
}

function publishMutation(
  outcome: InvestigationMutationDiagnostic["outcome"]
): InvestigationMutationDiagnostic {
  return { outcome, scope: "investigation candidate publish collection" };
}

function sameSources(
  left: readonly Readonly<{ id: string; text: string }>[],
  right: readonly Readonly<{ id: string; text: string }>[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (source, index) =>
        source.id === right[index]?.id && source.text === right[index]?.text
    )
  );
}

function sameResourceSnapshots(
  left: readonly InvestigationPublishPreparation["resourceSnapshot"][number][],
  right: readonly InvestigationPublishPreparation["resourceSnapshot"][number][]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (resource, index) =>
        resource.id === right[index]?.id &&
        resource.dev === right[index]?.dev &&
        resource.ino === right[index]?.ino
    )
  );
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function isPublishResult(
  value: unknown
): value is InvestigationCandidatePublishResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "changed") === "boolean" &&
    Array.isArray(Reflect.get(value, "errors")) &&
    Array.isArray(Reflect.get(value, "ids"))
  );
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    Reflect.get(error, "code") === "ENOENT"
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
