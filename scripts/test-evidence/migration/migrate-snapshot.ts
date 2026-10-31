import type {
  ExpectedSource,
  Snapshot,
  SnapshotEntity
} from "./migrate-types.ts";
import { MigrationError } from "./migrate-types.ts";
import {
  isOpaqueToken,
  isRecord,
  isSingleLine,
  isSorted,
  keys
} from "./migrate-values.ts";

export function parseMigrationSnapshot(input: unknown): Snapshot {
  if (
    !isRecord(input) ||
    keys(input) !== "completeness,entities,schemaVersion,source" ||
    input.schemaVersion !== 2 ||
    (input.completeness !== "complete" && input.completeness !== "partial") ||
    !isRecord(input.source) ||
    keys(input.source) !== "projectId,revision,scopeId" ||
    !Array.isArray(input.entities)
  ) {
    throw new MigrationError(
      "snapshot must use schemaVersion 2 with source, completeness, and entities"
    );
  }
  const source = input.source as Record<string, unknown>;
  for (const field of ["projectId", "scopeId", "revision"] as const) {
    if (!isSingleLine(source[field])) {
      throw new MigrationError(
        `snapshot source.${field} must be non-empty single-line text`
      );
    }
  }
  const entities = input.entities.map(parseSnapshotEntity);
  if (
    new Set(entities.map((entry) => entry.id)).size !== entities.length ||
    !isSorted(entities.map((entry) => entry.id))
  ) {
    throw new MigrationError("snapshot entity IDs must be unique and sorted");
  }
  return {
    completeness: input.completeness,
    entities,
    schemaVersion: 2,
    source: source as ExpectedSource
  };
}

function parseSnapshotEntity(entity: unknown): SnapshotEntity {
  if (
    !isRecord(entity) ||
    keys(entity) !== "id,locators,name" ||
    typeof entity.id !== "string" ||
    !isSingleLine(entity.name) ||
    !Array.isArray(entity.locators)
  ) {
    throw new MigrationError("snapshot has an invalid entity");
  }
  const id = entity.id;
  if (!isOpaqueToken(id)) {
    throw new MigrationError(`snapshot entity ID is invalid: ${id}`);
  }
  const locators = entity.locators;
  if (
    locators.length === 0 ||
    !locators.every(isSingleLine) ||
    new Set(locators).size !== locators.length ||
    !isSorted(locators as string[])
  ) {
    throw new MigrationError(`snapshot entity ${id} has invalid locators`);
  }
  return { id, locators: locators as string[], name: entity.name };
}

export function assertExpectedSource(
  snapshot: Snapshot,
  expected: ExpectedSource
): void {
  for (const key of ["projectId", "scopeId", "revision"] as const) {
    if (
      !isSingleLine(expected[key]) ||
      snapshot.source[key] !== expected[key]
    ) {
      throw new MigrationError(
        `snapshot source.${key} does not match expected source`
      );
    }
  }
}

export function locatorIndex(
  entities: readonly SnapshotEntity[]
): ReadonlyMap<string, readonly SnapshotEntity[]> {
  const result = new Map<string, SnapshotEntity[]>();
  for (const entity of entities) {
    for (const locator of entity.locators) {
      const values = result.get(locator) ?? [];
      values.push(entity);
      result.set(locator, values);
    }
  }
  return result;
}
