import * as v from "valibot";
import { createDiagnostic, sortUniqueDiagnostics } from "./diagnostics.ts";
import { testEntryInventorySchema } from "./schemas.ts";
import type {
  TestEntryInventory,
  TestEvidenceDiagnostic
} from "./types.ts";
import { normalizeWorkspaceRelative } from "./workspace-path.ts";

export type ParsedTestEntryInventory = {
  diagnostics: TestEvidenceDiagnostic[];
  inventory: TestEntryInventory | null;
};

export function parseTestEntryInventory(
  value: unknown,
  source = "test entry inventory"
): ParsedTestEntryInventory {
  const parsed = v.safeParse(testEntryInventorySchema, value);
  if (!parsed.success) {
    return {
      diagnostics: sortUniqueDiagnostics(parsed.issues.map((issue) => {
        const issuePath = v.getDotPath(issue);
        return createDiagnostic({
          category: "inventory",
          code: "inventory.schema-invalid",
          message: `${source}${issuePath === null ? "" : ` ${issuePath}`} ${issue.message}`,
          path: source,
          severity: "error"
        });
      })),
      inventory: null
    };
  }

  const diagnostics: TestEvidenceDiagnostic[] = [];
  const entriesById = new Map<string, TestEntryInventory["entries"][number]>();
  const entryLocations = new Set<string>();
  for (const entry of parsed.output.entries) {
    validatePath(entry.path, source, diagnostics);
    if (entriesById.has(entry.id)) {
      diagnostics.push(createDiagnostic({
        category: "inventory",
        code: "inventory.entry-id-duplicate",
        message: `${source} contains duplicate test entry ID: ${entry.id}`,
        path: entry.path,
        severity: "error"
      }));
    } else {
      entriesById.set(entry.id, entry);
    }
    const location = `${entry.path}\0${entry.offset}`;
    if (entryLocations.has(location)) {
      diagnostics.push(createDiagnostic({
        category: "inventory",
        code: "inventory.entry-location-duplicate",
        column: entry.column,
        line: entry.line,
        message: `${source} contains multiple entries at ${entry.path}:${entry.line}:${entry.column}`,
        path: entry.path,
        severity: "error"
      }));
    }
    entryLocations.add(location);
  }
  for (const marker of parsed.output.markers) {
    validatePath(marker.path, source, diagnostics);
    if (marker.targetEntryId === null) {
      continue;
    }
    const target = entriesById.get(marker.targetEntryId);
    if (target === undefined) {
      diagnostics.push(createDiagnostic({
        caseId: marker.caseId,
        category: "inventory",
        code: "inventory.marker-target-missing",
        line: marker.line,
        message: `${marker.path}:${marker.line} references missing test entry ${marker.targetEntryId}`,
        path: marker.path,
        severity: "error"
      }));
    } else if (target.path !== marker.path) {
      diagnostics.push(createDiagnostic({
        caseId: marker.caseId,
        category: "inventory",
        code: "inventory.marker-target-path-mismatch",
        line: marker.line,
        message: `${marker.path}:${marker.line} marker and target entry must use the same path`,
        path: marker.path,
        severity: "error"
      }));
    }
  }
  return {
    diagnostics: sortUniqueDiagnostics(diagnostics),
    inventory: diagnostics.length === 0 ? parsed.output : null
  };
}

function validatePath(
  value: string,
  source: string,
  diagnostics: TestEvidenceDiagnostic[]
): void {
  if (normalizeWorkspaceRelative(value) !== value) {
    diagnostics.push(createDiagnostic({
      category: "inventory",
      code: "inventory.path-invalid",
      message: `${source} path must be normalized and workspace-relative: ${value}`,
      path: value,
      severity: "error"
    }));
  }
}
