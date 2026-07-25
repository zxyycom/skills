import type {
  DeepReadonly,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  ReadonlyJsonObject,
  ReadonlyJsonValue
} from "./json.ts";
import type {
  StateIndex as StateIndexValue,
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

export type {
  DeepReadonly,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  ReadonlyJsonObject,
  ReadonlyJsonValue
} from "./json.ts";
export type {
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
  State extends object = JsonObject
> = Omit<StateIndexEntryValue, "state"> & {
  state: State;
};

export type StateIndex<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
> = Omit<StateIndexValue, "entries" | "metadata"> & {
  entries: StateIndexEntry<State>[];
  metadata: Metadata;
};

export type ReadonlyStateIndexEntry<State extends object> = {
  readonly id: string;
  readonly keys: {
    readonly [name: string]: readonly StateIndexKeyScalar[];
  };
  readonly state: DeepReadonly<State>;
};

export type ReadonlyStateIndex<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
> = {
  readonly definitionVersion: number;
  readonly entries: readonly ReadonlyStateIndexEntry<State>[];
  readonly keyDefinitions: readonly DeepReadonly<StateIndexKeyDefinition>[];
  readonly metadata: DeepReadonly<Metadata>;
  readonly namespace: string;
  readonly schemaVersion: StateIndexValue["schemaVersion"];
  readonly sourceRevision: string;
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

export type StateSnapshot<
  State extends object,
  Metadata extends JsonObject = JsonObject
> = {
  metadata: Metadata;
  revision: string;
  states: readonly State[];
};

export type StateIndexFieldOrder = "definition" | "lexicographic";

export type StateKeyInput =
  | StateIndexKeyScalar
  | readonly StateIndexKeyScalar[]
  | undefined;

export type StateIndexProjectionContext<
  Metadata extends JsonObject = JsonObject
> = Readonly<{
  metadata: DeepReadonly<Metadata>;
}>;

export type StateKeyStrategy<
  State extends object,
  Metadata extends JsonObject = JsonObject
> = {
  derive: (
    state: State,
    context: StateIndexProjectionContext<Metadata>
  ) => StateKeyInput;
  mode: StateIndexKeyMode;
  name: string;
};

export type StateIndexDefinition<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
> = {
  definitionVersion: number;
  fieldOrder?: StateIndexFieldOrder;
  identify: (
    state: State,
    context: StateIndexProjectionContext<Metadata>
  ) => string;
  keyStrategies: readonly StateKeyStrategy<State, Metadata>[];
  namespace: string;
  parseMetadata: (metadata: JsonObject) => Metadata;
  parseState: (
    state: JsonObject,
    context: StateIndexProjectionContext<Metadata>
  ) => State;
  read: (
    context: StateIndexContext
  ) => Promise<StateSnapshot<State, Metadata>>;
  readRevision: (context: StateIndexContext) => Promise<string>;
  validateIndex?: (
    index: ReadonlyStateIndex<State, Metadata>
  ) => void;
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
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
> = {
  entries: StateIndexEntry<State>[];
  limit: number;
  readonly metadata: DeepReadonly<Metadata>;
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
