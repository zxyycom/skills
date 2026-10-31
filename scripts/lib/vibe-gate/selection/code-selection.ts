import type { GateCheckConfiguration } from "../contracts.ts";
import { gateToolScopes, isGateCodePattern } from "../impact/impact-tools.ts";

type CodeArea = Readonly<{ files: Readonly<{ patterns: readonly string[] }> }>;

/** Keep each scope's ordered exclusions local; native metrics deduplicate areas. */
export function selectGateCodeAreas<const Area extends CodeArea>(
  areas: Readonly<Record<string, Area>>,
  configuration: GateCheckConfiguration
): Readonly<Record<string, Omit<Area, "files"> & CodeArea>> {
  if (configuration.scope !== "selected") return areas;
  const entries = [...new Set(configuration.selectionScopes)].flatMap((id) => {
    const { files, kind } = gateToolScopes[id];
    if (kind !== "code") return [];
    return files.flatMap((pattern, index) => {
      if (!isGateCodePattern(pattern)) return [];
      // Native lists are ordered: a later positive can re-include a path. Each
      // positive therefore gets its own intersection and only subsequent negatives.
      const exclusions = files
        .slice(index + 1)
        .filter((file) => file.startsWith("!"));
      return Object.entries(areas).map(
        ([role, area]) =>
          [
            `${id}-${index}-${role}`,
            {
              ...area,
              files: {
                ...area.files,
                patterns: [
                  ...area.files.patterns,
                  // Excluding the complement intersects the role with one domain
                  // pattern using the native micromatch grammar, without disk I/O.
                  `!@(!(${pattern}))`,
                  ...exclusions
                ]
              }
            }
          ] as const
      );
    });
  });
  // A non-code selection disables the Check; constructors still require areas.
  return entries.length === 0 ? areas : Object.fromEntries(entries);
}
