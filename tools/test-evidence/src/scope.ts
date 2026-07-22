import picomatch from "picomatch";

const matcherOptions = {
  dot: true,
  nonegate: true,
  strictBrackets: true
} as const;

export type ScopeMatcher = {
  matches: (relativePath: string) => boolean;
  pattern: string;
};

export function compileScopePattern(pattern: string): ScopeMatcher {
  if (pattern.startsWith("!")) {
    throw new SyntaxError("negative patterns are not supported");
  }

  const matches = picomatch(pattern, matcherOptions);
  return { matches, pattern };
}

export function matchesAnyScope(
  relativePath: string,
  matchers: readonly ScopeMatcher[]
): boolean {
  return matchers.some((matcher) => matcher.matches(relativePath));
}
