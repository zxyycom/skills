import { createHash } from "node:crypto";

export function compareLexicalText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function isStrictlyAscendingLexical(values: readonly string[]): boolean {
  return values.every(
    (value, index) =>
      index === 0 || compareLexicalText(values[index - 1] ?? "", value) < 0
  );
}

export function sha256Fingerprint(value: string): string {
  const hash = createHash("sha256").update(value, "utf8").digest("hex");
  return `sha256:${hash}`;
}
