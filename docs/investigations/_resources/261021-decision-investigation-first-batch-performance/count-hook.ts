// 仅计数进程加载；墙钟进程不加载本文件。
import fs from "node:fs/promises";
import { registerHooks, syncBuiltinESMExports } from "node:module";
import { count, measurement } from "./counter-state.ts";

declare global {
  var firstBatchCount: typeof count;
}
globalThis.firstBatchCount = count;

const probes: Readonly<Record<string, readonly [string, string][]>> = {
  "/tools/shared/src/markdown/frontmatter.ts": [
    ["const match = markdown.match(", 'globalThis.firstBatchCount("yaml");']
  ],
  "/tools/index-runtime/src/reader.ts": [
    [
      "const definition = defineStateIndexDefinition(options.definition);",
      'globalThis.firstBatchCount("readerConstruction");'
    ],
    [
      "const entries = effectiveEntries(queryOptions.runtimeStates);",
      'globalThis.firstBatchCount("readerQuery");'
    ]
  ],
  "/tools/index-runtime/src/query.ts": [
    [
      "const entries = options.entries.filter((entry) =>",
      'globalThis.firstBatchCount("queryFilterInputElements", options.entries.length);'
    ],
    [
      "entries.sort((left, right) => compareEntries(left, right, sort));",
      'globalThis.firstBatchCount("querySortInputElements", entries.length);'
    ]
  ],
  "/tools/investigation-report/src/query-search-selection.ts": [
    [
      "if (query.relatedTo === undefined)\n    return filterTypeOnlyRelations",
      'globalThis.firstBatchCount("relationProjection");'
    ]
  ]
};

registerHooks({
  load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    const probe = Object.entries(probes).find(([suffix]) =>
      url.endsWith(suffix)
    );
    if (probe === undefined) return loaded;
    if (loaded.source === undefined || loaded.source === null)
      throw new Error(`Missing source: ${url}`);
    let source =
      typeof loaded.source === "string"
        ? loaded.source
        : new TextDecoder().decode(loaded.source);
    for (const [marker, insertion] of probe[1]) {
      if (!source.includes(marker))
        throw new Error(`Missing probe: ${url}: ${marker}`);
      source = source.replace(marker, `${insertion}\n${marker}`);
    }
    return { ...loaded, source };
  }
});

fs.readFile = new Proxy(fs.readFile, {
  apply(target, thisArg: unknown, args: unknown[]) {
    const name = args[0];
    if (
      typeof name === "string" &&
      name.startsWith(`${measurement.fixtureRoot}/`)
    ) {
      if (name.endsWith(".md")) count("markdownReads");
      if (name.endsWith("-index.json")) count("indexReads");
    }
    return Reflect.apply(target, thisArg, args);
  }
});
JSON.parse = new Proxy(JSON.parse, {
  apply(target, thisArg: unknown, args: unknown[]) {
    const stack = new Error().stack ?? "";
    if (stack.includes("parseStateIndex")) count("fullIndexJsonParses");
    return Reflect.apply(target, thisArg, args);
  }
});
Date.parse = new Proxy(Date.parse, {
  apply(target, thisArg: unknown, args: unknown[]) {
    count("dateParses");
    return Reflect.apply(target, thisArg, args);
  }
});
syncBuiltinESMExports();
