import { createDiagnostic } from "./diagnostics.ts";
import {
  sourceMarkerRoles,
  type TestEntryMarker,
  type TestEvidenceDiagnostic,
  type SourceMarkerRole
} from "./types.ts";

const markerLinePattern =
  /^\s*(?:(?:\/\/)|#|--|;|\/\*+|\*|<!--)\s*@test-evidence\b(.*?)\s*$/u;

export type SourceMarkerCollection = {
  diagnostics: TestEvidenceDiagnostic[];
  markers: TestEntryMarker[];
};

export function collectSourceMarkers(
  text: string,
  relativePath: string
): SourceMarkerCollection {
  const diagnostics: TestEvidenceDiagnostic[] = [];
  const markers: TestEntryMarker[] = [];
  const lines = text.split(/\r?\n/u);
  const lineOffsets = collectLineOffsets(text);
  for (const [index, line] of lines.entries()) {
    const match = line.match(markerLinePattern);
    if (match === null) {
      continue;
    }

    const value = stripMarkerSuffix(match[1] ?? "");
    const tokens = value.split(/\s+/u).filter((token) => token.length > 0);
    const role = tokens[0];
    const caseId = tokens[1];
    if (tokens.length !== 2 || !isSourceMarkerRole(role) || caseId === undefined) {
      diagnostics.push(createDiagnostic({
        category: "discovery",
        code: "discovery.marker-invalid",
        line: index + 1,
        message: `${relativePath}:${index + 1} @test-evidence must use exactly: `
          + "@test-evidence <main|derived|exempt> <CASE-ID>",
        path: relativePath,
        severity: "error"
      }));
      continue;
    }

    markers.push({
      caseId,
      line: index + 1,
      offset: lineOffsets[index] ?? 0,
      path: relativePath,
      role,
      targetEntryId: null
    });
  }
  return { diagnostics, markers };
}

function stripMarkerSuffix(value: string): string {
  return value.replace(/\s*(?:\*\/|-->)\s*$/u, "").trim();
}

function isSourceMarkerRole(value: string | undefined): value is SourceMarkerRole {
  return sourceMarkerRoles.some((role) => role === value);
}

function collectLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      offsets.push(index + 1);
    }
  }
  return offsets;
}
