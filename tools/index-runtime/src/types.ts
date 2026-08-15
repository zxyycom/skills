import type { DeepReadonly, JsonObject } from "./json.ts";
import type {
  StateIndex as StateIndexValue,
  StateIndexStoredEntry as StateIndexStoredEntryValue,
  StateIndexKeyDefinition,
  StateIndexKeyMode,
  StateIndexKeyScalar
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

export type StateIndexEntry<State extends object = JsonObject> =
  StateIndexStoredEntry<State> & {
    id: string;
  };

export type StateIndexStoredEntry<State extends object = JsonObject> = Omit<
  StateIndexStoredEntryValue,
  "state"
> & {
  state: State;
};

export type StateRecord<State extends object = JsonObject> = Readonly<{
  [id: string]: State;
}>;

export type StateSourceRevision = Readonly<{
  entries: Readonly<Record<string, string>>;
  metadata: string;
}>;

export type StateIndex<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
> = Omit<StateIndexValue, "entries" | "metadata" | "sourceRevision"> & {
  entries: StateRecord<StateIndexStoredEntry<State>>;
  metadata: Metadata;
  sourceRevision: StateSourceRevision;
};

export type ReadonlyStateIndexStoredEntry<State extends object> = {
  readonly keys: {
    readonly [name: string]: readonly StateIndexKeyScalar[];
  };
  readonly state: DeepReadonly<State>;
};

export type ReadonlyStateIndexEntry<State extends object> =
  ReadonlyStateIndexStoredEntry<State> & {
    readonly id: string;
  };

export type ReadonlyStateIndex<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
> = {
  readonly definitionVersion: number;
  readonly entries: Readonly<{
    [id: string]: ReadonlyStateIndexStoredEntry<State>;
  }>;
  readonly keyDefinitions: readonly DeepReadonly<StateIndexKeyDefinition>[];
  readonly metadata: DeepReadonly<Metadata>;
  readonly namespace: string;
  readonly schemaVersion: StateIndexValue["schemaVersion"];
  readonly sourceRevision: DeepReadonly<StateSourceRevision>;
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
  sourceRevision: StateSourceRevision;
  states: StateRecord<State>;
};

export type StateIndexFieldOrder = "definition" | "lexicographic";

export type StateKeyInput =
  | StateIndexKeyScalar
  | readonly StateIndexKeyScalar[]
  | undefined;

export type StateIndexProjectionContext<
  Metadata extends JsonObject = JsonObject
> = Readonly<{
  id: string;
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
  keyStrategies: readonly StateKeyStrategy<State, Metadata>[];
  namespace: string;
  parseMetadata: (metadata: JsonObject) => Metadata;
  parseState: (
    state: JsonObject,
    context: StateIndexProjectionContext<Metadata>
  ) => State;
  read: (context: StateIndexContext) => Promise<StateSnapshot<State, Metadata>>;
  readRevision: (context: StateIndexContext) => Promise<StateSourceRevision>;
  validateIndex?: (index: ReadonlyStateIndex<State, Metadata>) => void;
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

type StateIndexEntryStageBase = {
  diagnostics: StateIndexDiagnostic[];
  indexPath: string;
  namespace: string;
  selectedIds: string[];
};

export type StateIndexEntryStageResult =
  | (StateIndexEntryStageBase & {
      changed: true;
      state: "staged";
      status: "ok";
    })
  | (StateIndexEntryStageBase & {
      changed: false;
      state: "unchanged";
      status: "ok";
    })
  | (StateIndexEntryStageBase & {
      changed: false;
      state:
        | "collection-changed"
        | "definition-invalid"
        | "index-path-invalid"
        | "operation-aborted"
        | "pending-conflict"
        | "pending-write-failed"
        | "revision-index-invalid"
        | "revision-read-failed"
        | "selection-invalid"
        | "target-invalid"
        | "workspace-index-invalid";
      status: "error";
    })
  | (StateIndexEntryStageBase & {
      changed: null;
      state: "pending-recovery-failed";
      status: "error";
    });
