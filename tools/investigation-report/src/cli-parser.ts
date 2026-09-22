import { normalizeInvestigationIdInput } from "./report-path.ts";
import type { InvestigationCommand, ParsedCli } from "./cli-contract.ts";

export function valueOf(
  values: ReadonlyMap<string, string[]>,
  key: string
): string | undefined {
  const selected = values.get(key);
  return selected?.length === 1 ? selected[0] : undefined;
}

export function valuesOf(
  values: ReadonlyMap<string, string[]>,
  key: string
): string[] | undefined {
  const selected = values.get(key);
  return selected === undefined ? undefined : [...selected];
}

export function has(
  values: ReadonlyMap<string, string[]>,
  key: string
): boolean {
  return values.has(key);
}

export function location(values: ReadonlyMap<string, string[]>): {
  investigationsDir?: string;
  workspaceRoot: string;
} {
  const investigationsDir = valueOf(values, "investigations-dir");
  const workspaceRoot = valueOf(values, "root") ?? ".";
  return investigationsDir === undefined
    ? { workspaceRoot }
    : { investigationsDir, workspaceRoot };
}

export function numberValue(
  values: ReadonlyMap<string, string[]>,
  key: string
): number | undefined {
  const value = valueOf(values, key);
  return value === undefined ? undefined : Number(value);
}

export function assertNoPositionals(input: ParsedCli): string | null {
  return input.positionals.length === 0
    ? null
    : `${input.command} does not accept positional arguments`;
}

export function assertAllowedOptions(
  input: ParsedCli,
  allowed: readonly string[]
): string | null {
  const invalid = [...input.values.keys()].find(
    (key) => !key.startsWith("__") && !allowed.includes(key)
  );
  return invalid === undefined
    ? null
    : `${input.command} does not accept --${invalid}`;
}

export function assertSingleOptions(
  input: ParsedCli,
  options: readonly string[]
): string | null {
  const repeated = options.find(
    (option) => (input.values.get(option)?.length ?? 0) > 1
  );
  return repeated === undefined
    ? null
    : `${input.command} accepts --${repeated} only once`;
}

/**
 * Normalizes identity selectors at the CLI boundary so handlers and the
 * domain receive the same selector shapes regardless of the calling surface.
 */
export function normalizeIdentitySelectorsAtCliBoundary(
  command: InvestigationCommand,
  context: { positionals: string[]; values: Map<string, string[]> }
): void {
  if (
    [
      "new",
      "discard",
      "discard-candidate",
      "show",
      "show-candidate",
      "publish",
      "rename",
      "stage-index",
      "trace"
    ].includes(command)
  ) {
    context.positionals.splice(
      0,
      context.positionals.length,
      ...context.positionals.map(normalizeCompatibleInvestigationId)
    );
  }
  normalizeOptionValues(context, "id", normalizeCompatibleInvestigationId);
  normalizeOptionValues(context, "source", normalizeCompatibleInvestigationId);
  normalizeOptionValues(context, "relation", normalizeCompatibleRelationTarget);
  normalizeOptionValues(
    context,
    "relation-summary",
    normalizeCompatibleRelationSummaryTarget
  );
}

function normalizeOptionValues(
  context: { values: Map<string, string[]> },
  name: string,
  normalizer: (value: string) => string
): void {
  const values = context.values.get(name);
  if (values !== undefined) context.values.set(name, values.map(normalizer));
}

function normalizeCompatibleInvestigationId(value: string): string {
  return normalizeInvestigationIdInput(value) ?? value;
}

function normalizeCompatibleRelationTarget(value: string): string {
  const separator = value.indexOf("=");
  const target =
    separator < 0
      ? null
      : normalizeInvestigationIdInput(value.slice(separator + 1));
  return target === null ? value : value.slice(0, separator + 1) + target;
}

function normalizeCompatibleRelationSummaryTarget(value: string): string {
  const separator = value.indexOf("=");
  const target =
    separator < 0
      ? null
      : normalizeInvestigationIdInput(value.slice(0, separator));
  return target === null ? value : target + value.slice(separator);
}
