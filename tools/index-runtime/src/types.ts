import type { JsonObject, JsonPrimitive, JsonValue } from "./json.ts";
import type {
  StateIndex,
  StateIndexEntry as StateIndexEntryValue,
  StateIndexFilter,
  StateIndexKeyDefinition,
  StateIndexKeyMode,
  StateIndexKeyScalar,
  StateIndexQuery,
  StateIndexQueryValue,
  StateIndexRangeScalar,
  StateIndexSort
} from "./schemas.ts";

export type { JsonObject, JsonPrimitive, JsonValue } from "./json.ts";
export type {
  StateIndex,
  StateIndexFilter,
  StateIndexKeyDefinition,
  StateIndexKeyMode,
  StateIndexKeyScalar,
  StateIndexQuery,
  StateIndexQueryValue,
  StateIndexRangeScalar,
  StateIndexSort
} from "./schemas.ts";

export type StateIndexEntry<
  State extends JsonObject = JsonObject
> = Omit<StateIndexEntryValue, "state"> & {
  state: State;
};

export type StateIndexDiagnostic = {
  code: string;
  message: string;
  path: string | null;
  stateId: string | null;
};

export type StateIndexContext = {
  root: string;
  signal?: AbortSignal;
};

export type StateSnapshot<State extends JsonObject> = {
  revision: string;
  states: readonly State[];
};

export type StateKeyInput =
  | StateIndexKeyScalar
  | readonly StateIndexKeyScalar[]
  | undefined;

export type StateKeyStrategy<State extends JsonObject> = {
  derive: (state: State) => StateKeyInput;
  mode: StateIndexKeyMode;
  name: string;
};

export type StateIndexDefinition<State extends JsonObject = JsonObject> = {
  definitionVersion: number;
  identify: (state: State) => string;
  keyStrategies: readonly StateKeyStrategy<State>[];
  namespace: string;
  parseState: (state: JsonObject) => State;
  read: (context: StateIndexContext) => Promise<StateSnapshot<State>>;
  readRevision: (context: StateIndexContext) => Promise<string>;
};

export type StateIndexExpectation = {
  definitionVersion: number;
  namespace: string;
};

export type StateIndexResult<Value> =
  | {
    diagnostics: StateIndexDiagnostic[];
    status: "ok";
    value: Value;
  }
  | {
    diagnostics: StateIndexDiagnostic[];
    status: "error";
    value: null;
  };

export type StateIndexQueryOutput<
  State extends JsonObject = JsonObject
> = {
  entries: StateIndexEntry<State>[];
  limit: number;
  offset: number;
  total: number;
};

export type StateIndexSyncMode = "check" | "write";

type StateIndexSyncBase = {
  changed: boolean;
  diagnostics: StateIndexDiagnostic[];
  indexPath: string;
  namespace: string;
};

export type StateIndexSyncResult =
  | (StateIndexSyncBase & {
    changed: false;
    mode: StateIndexSyncMode;
    state: "current" | "unchanged";
    status: "ok";
  })
  | (StateIndexSyncBase & {
    changed: true;
    mode: StateIndexSyncMode;
    state: "written";
    status: "ok";
  })
  | (StateIndexSyncBase & {
    changed: false;
    mode: StateIndexSyncMode;
    state:
      | "index-invalid"
      | "index-missing"
      | "index-path-invalid"
      | "index-read-failed"
      | "index-stale"
      | "index-write-failed"
      | "source-invalid";
    status: "error";
  })
  | (StateIndexSyncBase & {
    changed: false;
    mode: null;
    state: "mode-invalid";
    status: "error";
  });
