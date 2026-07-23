import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import {
  defineStateIndexDefinition,
  isJsonObject,
  isJsonValue,
  type JsonObject,
  type JsonValue,
  type StateIndexDefinition,
  type StateIndexResult
} from "../src/index.ts";

const fixtureRoot = fileURLToPath(new URL("./fixtures/", import.meta.url));

const jsonObjectSchema = v.custom<JsonObject>(
  isJsonObject,
  "must be a JSON object"
);
const jsonValueSchema = v.custom<JsonValue>(
  isJsonValue,
  "must be a finite JSON value"
);
const decisionStateSchema = v.strictObject({
  alignment: v.nullable(v.picklist(["aligned", "unaligned"])),
  background: v.string(),
  createdAt: v.string(),
  decision: v.string(),
  path: v.string(),
  purpose: v.string(),
  relations: v.array(jsonValueSchema),
  status: v.picklist(["active", "archived"]),
  title: v.string()
});
const investigationStateSchema = v.strictObject({
  id: v.string(),
  latestAt: v.string(),
  path: v.string(),
  question: v.string(),
  status: v.string(),
  title: v.string(),
  topic: v.string()
});
const testEvidenceStateSchema = v.strictObject({
  caseId: v.string(),
  codePath: v.string(),
  contract: v.array(v.string()),
  line: v.pipe(v.number(), v.integer(), v.safeInteger()),
  proves: v.array(v.string()),
  status: v.picklist(["active", "planned"]),
  title: v.string(),
  trigger: v.nullable(jsonObjectSchema),
  verification: v.picklist(["automated", "exempt", "review"])
});

export type DecisionState = v.InferOutput<typeof decisionStateSchema>;
export type InvestigationState = v.InferOutput<typeof investigationStateSchema>;
export type TestEvidenceState = v.InferOutput<typeof testEvidenceStateSchema>;

export type MemoryStateSource<State extends JsonObject> = {
  revision: string;
  states: State[];
};

const decisionFixtureSchema = v.strictObject({
  records: v.array(decisionStateSchema),
  schemaVersion: v.literal(4)
});
const testEvidenceFixtureSchema = v.strictObject({
  cases: v.array(v.strictObject({
    codePath: v.string(),
    contract: v.array(v.string()),
    id: v.string(),
    line: v.pipe(v.number(), v.integer(), v.safeInteger()),
    proves: v.array(v.string()),
    status: v.picklist(["active", "planned"]),
    title: v.string(),
    trigger: v.nullable(jsonObjectSchema),
    verification: v.picklist(["automated", "exempt", "review"])
  }))
});

export async function decisionStates(): Promise<DecisionState[]> {
  const fixture = v.parse(
    decisionFixtureSchema,
    JSON.parse(await fs.readFile(`${fixtureRoot}decision-index.json`, "utf8"))
  );
  return fixture.records;
}

export async function investigationStates(): Promise<InvestigationState[]> {
  const text = await fs.readFile(`${fixtureRoot}investigation-index.md`, "utf8");
  const pattern = /^## ([^\r\n]+)\r?\n\r?\n- \[([^\]]+)\]\(([^)]+)\)\r?\n  - 核心问题: ([^\r\n]+)\r?\n  - 状态: ([^\r\n]+)\r?\n  - 最新报告时间: ([^\r\n]+)/gmu;
  return [...text.matchAll(pattern)].map((match) => {
    const [, topic, title, relativePath, question, status, latestAt] = match;
    assert.ok(topic && title && relativePath && question && status && latestAt);
    return {
      id: `topic:${topic}`,
      latestAt,
      path: `docs/investigations/${relativePath}`,
      question,
      status,
      title,
      topic
    };
  });
}

export async function testEvidenceStates(): Promise<TestEvidenceState[]> {
  const fixture = v.parse(
    testEvidenceFixtureSchema,
    JSON.parse(await fs.readFile(`${fixtureRoot}test-evidence-inspection.json`, "utf8"))
  );
  return fixture.cases.map((entry) => ({
    caseId: entry.id,
    codePath: entry.codePath,
    contract: entry.contract,
    line: entry.line,
    proves: entry.proves,
    status: entry.status,
    title: entry.title,
    trigger: entry.trigger,
    verification: entry.verification
  }));
}

export function decisionDefinition(
  source: MemoryStateSource<DecisionState>
): StateIndexDefinition<DecisionState> {
  return defineStateIndexDefinition({
    definitionVersion: 1,
    identify: (state) => state.path,
    keyStrategies: [
      { derive: (state) => state.status, mode: "exact", name: "status" },
      { derive: (state) => state.alignment ?? undefined, mode: "exact", name: "alignment" },
      {
        derive: (state) => timestampRangeKey(state.createdAt),
        mode: "range",
        name: "created-at"
      },
      { derive: (state) => state.path, mode: "exact", name: "path" },
      {
        derive: (state) => [
          state.title,
          state.purpose,
          state.background,
          state.decision
        ],
        mode: "text",
        name: "text"
      }
    ],
    namespace: "decisions",
    parseState: (state) => v.parse(decisionStateSchema, state),
    read: async () => ({ revision: source.revision, states: [...source.states] }),
    readRevision: async () => source.revision
  });
}

export function investigationDefinition(
  source: MemoryStateSource<InvestigationState>
): StateIndexDefinition<InvestigationState> {
  return defineStateIndexDefinition({
    definitionVersion: 1,
    identify: (state) => state.id,
    keyStrategies: [
      { derive: (state) => state.status, mode: "exact", name: "status" },
      { derive: (state) => state.topic, mode: "exact", name: "topic" },
      {
        derive: (state) => timestampRangeKey(state.latestAt),
        mode: "range",
        name: "latest-at"
      },
      { derive: (state) => state.path, mode: "exact", name: "path" },
      {
        derive: (state) => [state.title, state.question],
        mode: "text",
        name: "text"
      }
    ],
    namespace: "investigations",
    parseState: (state) => v.parse(investigationStateSchema, state),
    read: async () => ({ revision: source.revision, states: [...source.states] }),
    readRevision: async () => source.revision
  });
}

export function testEvidenceDefinition(
  source: MemoryStateSource<TestEvidenceState>
): StateIndexDefinition<TestEvidenceState> {
  return defineStateIndexDefinition({
    definitionVersion: 1,
    identify: (state) => `${state.caseId}@${state.line}`,
    keyStrategies: [
      { derive: (state) => state.caseId, mode: "exact", name: "case-id" },
      { derive: (state) => state.status, mode: "exact", name: "status" },
      { derive: (state) => state.verification, mode: "exact", name: "verification" },
      {
        derive: (state) => state.trigger === null ? undefined : true,
        mode: "exact",
        name: "review-triggered"
      },
      { derive: (state) => state.line, mode: "range", name: "line" },
      {
        derive: (state) => [state.title, ...state.contract, ...state.proves],
        mode: "text",
        name: "text"
      }
    ],
    namespace: "test-evidence",
    parseState: (state) => v.parse(testEvidenceStateSchema, state),
    read: async () => ({ revision: source.revision, states: [...source.states] }),
    readRevision: async () => source.revision
  });
}

function timestampRangeKey(value: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`invalid RFC 3339 timestamp ${value}`);
  }
  return timestamp;
}

export function resultValue<Value>(result: StateIndexResult<Value>): Value {
  if (result.status === "error") {
    assert.fail(JSON.stringify(result.diagnostics));
  }
  return result.value;
}
