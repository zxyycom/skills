import path from "node:path";
import {
  legacyIndexFile,
  legacyRoot,
  legacyTopicsFile,
  loadLegacyCatalog,
  sha256
} from "./legacy.ts";
import {
  assertNewCases,
  assertTargetsAvailable,
  buildMigrationIndex,
  convertLegacyCase
} from "./migrate-conversion.ts";
import { printMigrationResult, readMigrationCliInput } from "./migrate-cli.ts";
import {
  assertExpectedSource,
  locatorIndex,
  parseMigrationSnapshot
} from "./migrate-snapshot.ts";
import {
  executeMigrationTransaction,
  rememberMigrationSources
} from "./migrate-transaction.ts";
import type { ExpectedSource, MigrationPlan } from "./migrate-types.ts";
import { MigrationError } from "./migrate-types.ts";
import { messageOf, uniqueSorted } from "./migrate-values.ts";

export type { MigrationPlan } from "./migrate-types.ts";
export { MigrationError } from "./migrate-types.ts";

type MigrationOptions = Readonly<{
  expectedSource: ExpectedSource;
  snapshot: unknown;
  workspaceRoot: string;
}>;

export async function planTestEvidenceMigration(
  options: MigrationOptions
): Promise<MigrationPlan> {
  const snapshot = parseMigrationSnapshot(options.snapshot);
  assertExpectedSource(snapshot, options.expectedSource);
  if (snapshot.completeness !== "complete") {
    throw new MigrationError("snapshot completeness must be complete");
  }
  const legacy = await loadLegacyCatalog(options.workspaceRoot);
  const byLocator = locatorIndex(snapshot.entities);
  const converted = legacy.cases.map((legacyCase) =>
    convertLegacyCase(legacyCase, byLocator)
  );
  const mappingErrors = converted.flatMap((entry) => entry.errors);
  if (mappingErrors.length > 0) {
    throw new MigrationError(
      `legacy Entries cannot map to exactly one snapshot entity:\n${mappingErrors.map((entry) => `- ${entry}`).join("\n")}`
    );
  }
  const cases = converted.map((entry) => entry.value!);
  assertNewCases(cases);
  const root = path.join(options.workspaceRoot, ...legacyRoot.split("/"));
  await assertTargetsAvailable(root, cases);
  const removedPaths = [
    ...legacy.cases.map((entry) => entry.sourcePath),
    ...uniqueSorted(
      legacy.cases.map((entry) => `${legacyRoot}/${entry.topicId}`)
    ),
    `${legacyRoot}/${legacyTopicsFile}`
  ];
  const plan: MigrationPlan = {
    addedPaths: [
      ...cases.map((entry) => `${legacyRoot}/${entry.sourcePath}`),
      `${legacyRoot}/${legacyIndexFile}`
    ],
    cases,
    index: buildMigrationIndex(cases),
    legacyCaseCount: legacy.cases.length,
    legacyFingerprints: legacy.fingerprints,
    removedPaths: uniqueSorted(removedPaths),
    snapshotFingerprint: sha256(JSON.stringify(snapshot))
  };
  await rememberMigrationSources(plan, options.workspaceRoot, legacy);
  return plan;
}

export async function writeTestEvidenceMigration(
  options: MigrationOptions
): Promise<MigrationPlan> {
  const plan = await planTestEvidenceMigration(options);
  await executeMigrationTransaction(options.workspaceRoot, plan, async () => {
    const current = await planTestEvidenceMigration(options);
    if (
      JSON.stringify(current.legacyFingerprints) !==
        JSON.stringify(plan.legacyFingerprints) ||
      current.snapshotFingerprint !== plan.snapshotFingerprint
    ) {
      throw new MigrationError(
        "legacy source or snapshot changed before write"
      );
    }
  });
  return plan;
}

async function runMigrationCli(argv: readonly string[]): Promise<void> {
  const input = await readMigrationCliInput(argv);
  const options: MigrationOptions = {
    expectedSource: input.expectedSource,
    snapshot: input.snapshot,
    workspaceRoot: input.workspaceRoot
  };
  const result = input.write
    ? await writeTestEvidenceMigration(options)
    : await planTestEvidenceMigration(options);
  printMigrationResult(result, input.write);
}

if (import.meta.main) {
  runMigrationCli(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${messageOf(error)}\n`);
    process.exitCode = 1;
  });
}
