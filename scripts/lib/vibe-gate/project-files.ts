import { DEFAULT_PROJECT_FILE_EXCLUDES } from "@zxyycom/vibe-check";

// scripts/build is maintained source, not an output directory. Keep every other
// upstream exclusion, including nested build outputs inside this source root.
const projectFileExclusions = DEFAULT_PROJECT_FILE_EXCLUDES.flatMap(
  (pattern) =>
    pattern === "**/build/**"
      ? [
          "build/**",
          "@(!(scripts)|scripts?*)/**/build/**",
          "scripts/@(!(build)|build?*)/**/build/**",
          "scripts/build/**/build/**"
        ]
      : [pattern]
);

export function maintainedProjectFiles(patterns: readonly string[]) {
  return {
    patterns: [
      ...patterns,
      ...projectFileExclusions.map((pattern) => `!${pattern}`)
    ],
    useDefaultExcludes: false
  } as const;
}
