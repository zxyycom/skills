import type { SourceMarker, SourceMarkerKind } from "./types.ts";

const markerLinePattern =
  /^\s*(?:(?:\/\/)|#|--|;|\/\*+|\*|<!--)\s*@(case|supports|test-exempt)\b(.*?)(?:\*\/|-->)?\s*$/u;

export function collectSourceMarkers(text: string, relativePath: string): SourceMarker[] {
  const markers: SourceMarker[] = [];
  for (const [index, line] of text.split(/\r?\n/u).entries()) {
    const match = line.match(markerLinePattern);
    if (match === null) {
      continue;
    }

    const kind = match[1] as SourceMarkerKind;
    const value = (match[2] ?? "").trim();
    if (kind === "test-exempt") {
      markers.push({
        id: null,
        kind,
        line: index + 1,
        reason: stripMarkerSuffix(value),
        relativePath
      });
      continue;
    }

    const id = stripMarkerSuffix(value).split(/\s+/u)[0] ?? "";
    markers.push({
      id,
      kind,
      line: index + 1,
      reason: null,
      relativePath
    });
  }
  return markers;
}

function stripMarkerSuffix(value: string): string {
  return value.replace(/\s*(?:\*\/|-->)\s*$/u, "").trim();
}
