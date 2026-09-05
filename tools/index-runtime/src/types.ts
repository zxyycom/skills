import type { FileSystemErrorCauseCategory } from "../../shared/src/node/filesystem-diagnostic.ts";
import type { VersionControlErrorCauseCategory } from "../../shared/src/version-control/errors.ts";
import type { DeepReadonly, JsonObject } from "./json.ts";
import type {
  StateIndex as StateIndexValue,
  StateIndexKeyMode
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
  StateIndexKeyMode,
  StateIndexKeyScalar,
  StateIndexQuery,
  StateIndexQueryValue,
  StateIndexRangeScalar,
  StateIndexSort
} from "./schemas.ts";

export type StateIndexEntry<State extends object = JsonObject> = {
  id: string;
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
  entries: StateRecord<State>;
  metadata: Metadata;
  sourceRevision: StateSourceRevision;
};

export type ReadonlyStateIndex<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
> = {
  readonly definitionVersion: number;
  readonly entries: Readonly<{ [id: string]: DeepReadonly<State> }>;
  readonly metadata: DeepReadonly<Metadata>;
  readonly namespace: string;
  readonly schemaVersion: StateIndexValue["schemaVersion"];
  readonly sourceRevision: DeepReadonly<StateSourceRevision>;
};

export type StateIndexDiagnostic = {
  code: string;
  filesystem?: StateIndexFilesystemDiagnostic;
  message: string;
  path: string | null;
  stateId: string | null;
  versionControl?: StateIndexVersionControlDiagnostic;
};

export type StateIndexFilesystemDiagnostic = Readonly<{
  causeCategory: FileSystemErrorCauseCategory;
  detail: string | null;
  operation: string;
  target: string | null;
}>;

export type StateIndexVersionControlDiagnostic = Readonly<{
  causeCategory: VersionControlErrorCauseCategory;
  detail: string | null;
  operation: string | null;
  target: string | null;
}>;

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

export type StateIndexEachPathSegment = Readonly<{ kind: "each" }>;
export type StateIndexStatePathSegment = string | StateIndexEachPathSegment;

export type StateIndexQuerySource =
  | Readonly<{ kind: "entry-id" }>
  | Readonly<{
      kind: "state-path";
      normalization?: "instant";
      path: readonly StateIndexStatePathSegment[];
    }>
  | Readonly<{ kind: "source-path-first-segment" }>;

export type StateIndexQueryField = Readonly<{
  mode: StateIndexKeyMode;
  name: string;
  sources: readonly StateIndexQuerySource[];
}>;

export type StateIndexQueryFieldDefinition = Readonly<{
  mode: StateIndexKeyMode;
  name: string;
}>;

export type StateIndexProjectionContext<
  Metadata extends JsonObject = JsonObject
> = Readonly<{
  id: string;
  metadata: DeepReadonly<Metadata>;
}>;

export type StateIndexDefinition<
  State extends object = JsonObject,
  Metadata extends JsonObject = JsonObject
> = {
  definitionVersion: number;
  fieldOrder?: StateIndexFieldOrder;
  namespace: string;
  parseMetadata: (metadata: JsonObject) => Metadata;
  parseState: (
    state: JsonObject,
    context: StateIndexProjectionContext<Metadata>
  ) => State;
  queryFields: readonly StateIndexQueryField[];
  read: (context: StateIndexContext) => Promise<StateSnapshot<State, Metadata>>;
  readRevision: (context: StateIndexContext) => Promise<StateSourceRevision>;
  validateIndex?: (index: ReadonlyStateIndex<State, Metadata>) => void;
};

export type StateIndexExpectation = {
  definitionVersion: number;
  namespace: string;
};

export type StateIndexResult<Value> =
  | { diagnostics: StateIndexDiagnostic[]; status: "ok"; value: Value }
  | { diagnostics: StateIndexDiagnostic[]; status: "error"; value: null };

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

/** `selected` limits accepted source changes, never validation or output scope. */
export type StateIndexSyncScope =
  | Readonly<{ kind: "all" }>
  | Readonly<{ kind: "selected"; selectedIds: readonly string[] }>;

type StateIndexSyncBase = {
  changedIds: string[];
  changed: boolean;
  diagnostics: StateIndexDiagnostic[];
  indexPath: string;
  namespace: string;
  scope: "all" | "selected";
  selectedIds: string[];
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
        | "selected-baseline-invalid"
        | "selected-id-missing"
        | "selection-invalid"
        | "collection-changed"
        | "scoped-stale"
        | "unselected-changes"
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
  pending?: StateIndexPendingMutation;
  selectedIds: string[];
};

export type StateIndexPendingMutation = Readonly<{
  outcome: "no-change" | "partial-or-unknown";
  scope: string;
}>;

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
      pending: StateIndexPendingMutation;
      state: "pending-recovery-failed";
      status: "error";
    });
