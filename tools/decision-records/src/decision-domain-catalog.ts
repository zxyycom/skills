import fs from "node:fs/promises";
import * as v from "valibot";
import { isDecisionDomainId } from "./decision-path.ts";

export const decisionDomainCatalogFileName = "decision-domains.json";
export const decisionDomainCatalogSchemaVersion = 1;

const domainDescriptionSchema = v.pipe(
  v.string("must be a string"),
  v.check(
    (value) => {
      const length = Array.from(value).length;
      return length >= 4 && length <= 200;
    },
    "must contain 4 to 200 Unicode code points"
  ),
  v.check((value) => !/[\r\n]/u.test(value), "must be a single line"),
  v.check((value) => value.trim() === value, "must not have surrounding whitespace")
);
const domainIdSchema = v.pipe(
  v.string("must be a string"),
  v.check(isDecisionDomainId, "must be a kebab-case domain id")
);
const decisionDomainDefinitionSchema = v.strictObject({
  id: domainIdSchema,
  description: domainDescriptionSchema
});

export const decisionDomainDefinitionsSchema = v.pipe(
  v.array(decisionDomainDefinitionSchema),
  v.check((domains) => domains.length > 0, "must define at least one domain"),
  v.check(
    (domains) => new Set(domains.map((domain) => domain.id)).size === domains.length,
    "domain ids must be unique"
  ),
  v.check(
    (domains) => domains.every((domain, index) => (
      index === 0 || domains[index - 1]!.id < domain.id
    )),
    "domains must be sorted by id in ascending lexical order"
  )
);

const decisionDomainCatalogSchema = v.strictObject({
  schemaVersion: v.literal(decisionDomainCatalogSchemaVersion),
  domains: decisionDomainDefinitionsSchema
});

export type DecisionDomainDefinition = v.InferOutput<
  typeof decisionDomainDefinitionSchema
>;

export type DecisionDomainCatalog = v.InferOutput<
  typeof decisionDomainCatalogSchema
>;

export type DecisionDomainCatalogResult =
  | {
    status: "error";
    errors: string[];
  }
  | {
    status: "ok";
    value: DecisionDomainCatalog;
  };

export async function loadDecisionDomainCatalog(
  catalogPath: string,
  displayPath: string
): Promise<DecisionDomainCatalogResult> {
  let text: string;
  try {
    text = await fs.readFile(catalogPath, "utf8");
  } catch (error) {
    return failure([
      isMissingFileError(error)
        ? displayPath + " is required"
        : displayPath + " could not be read: " + errorText(error)
    ]);
  }

  return parseDecisionDomainCatalog(text, displayPath);
}

export function parseDecisionDomainCatalog(
  text: string,
  displayPath: string
): DecisionDomainCatalogResult {
  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch (error) {
    return failure([
      displayPath + " must be valid JSON: " + errorText(error)
    ]);
  }

  const parsed = v.safeParse(decisionDomainCatalogSchema, input);
  if (!parsed.success) {
    return failure(parsed.issues.map((issue) => (
      displayPath + " " + formatCatalogIssue(issue)
    )));
  }

  return {
    status: "ok",
    value: parsed.output
  };
}

function failure(errors: string[]): DecisionDomainCatalogResult {
  return { status: "error", errors };
}

function formatCatalogIssue(issue: v.BaseIssue<unknown>): string {
  const issuePath = v.getDotPath(issue);
  return issuePath === null ? issue.message : `${issuePath} ${issue.message}`;
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
