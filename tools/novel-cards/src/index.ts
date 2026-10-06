import * as v from "valibot";
import {
  defineStateIndexDefinition,
  loadCurrentStateIndex,
  sameStateSourceRevision,
  syncStateIndex,
  type StateIndexDefinition,
  type StateIndexSyncResult
} from "../../index-runtime/src/index.ts";
import { CardFailure } from "./card.ts";
import { readSource, type Source } from "./source.ts";

const stateSchema = v.strictObject({
  title: v.string(),
  sourcePath: v.pipe(
    v.string(),
    v.regex(/^cards\/(?:current|reference)\/(?:[^/]+\/)*[^/]+\.md$/u)
  ),
  area: v.picklist(["current", "reference"])
});
type State = Readonly<v.InferOutput<typeof stateSchema>>;

function states(source: Source): Readonly<Record<string, State>> {
  return Object.fromEntries(
    source.records.map((record) => [
      record.card.id,
      {
        title: record.card.title,
        sourcePath: record.sourcePath,
        area: record.area
      }
    ])
  );
}

function definition(source: Source): StateIndexDefinition<State> {
  return defineStateIndexDefinition({
    namespace: "novel-cards",
    definitionVersion: 1,
    parseMetadata: (input) => v.parse(v.strictObject({}), input),
    parseState: (input) => v.parse(stateSchema, input),
    queryFields: [
      {
        name: "area",
        mode: "exact",
        sources: [{ kind: "state-path", path: ["area"] }]
      }
    ],
    read: async () => ({
      metadata: {},
      sourceRevision: source.revision,
      states: states(source)
    }),
    readRevision: async (context) => (await readSource(context.root)).revision
  });
}

export async function synchronize(root: string): Promise<StateIndexSyncResult> {
  const source = await readSource(root);
  return await syncStateIndex({
    context: { root },
    definition: definition(source),
    indexPath: "card-index.json",
    mode: "write"
  });
}

export async function currentSource(root: string): Promise<Source> {
  const source = await readSource(root);
  const loaded = await loadCurrentStateIndex({
    context: { root },
    definition: definition(source),
    indexPath: "card-index.json"
  });
  if (loaded.status === "error")
    throw new CardFailure(
      "index-invalid",
      "card-index.json",
      loaded.diagnostics
        .map((item) => `${item.code}: ${item.message}`)
        .join("; ")
    );
  if (!sameStateSourceRevision(loaded.value.sourceRevision, source.revision))
    throw new CardFailure(
      "source-changed",
      "card-index.json",
      "扫描期间来源变化，请重试"
    );
  const expected = states(source);
  for (const [id, state] of Object.entries(loaded.value.entries)) {
    const actual = expected[id];
    if (
      !actual ||
      state.sourcePath !== actual.sourcePath ||
      state.title !== actual.title ||
      state.area !== actual.area
    )
      throw new CardFailure(
        "index-identity",
        "card-index.json",
        `索引身份或位置与实际卡不一致：${id}；显式重建索引`
      );
  }
  return source;
}
