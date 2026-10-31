import "./version-control/protocol/version-control-errors.test.ts";
import "./version-control/revision/version-control-revision.test.ts";
import "./version-control/revision/version-control-revision-batch.test.ts";
import "./version-control/protocol/version-control-history.test.ts";
import "./version-control/workspace/version-control-workspace.test.ts";
import "./version-control/pending/version-control-replacement.test.ts";
import "./version-control/protocol/version-control-representation.test.ts";
import "./version-control/pending/version-control-pending.test.ts";
import "./version-control/protocol/version-control-boundaries.test.ts";
import "./version-control/workspace/version-control-workspace-batch.test.ts";
import "./version-control/protocol/version-control-pathspec-query.test.ts";

import "./version-control/protocol/version-control-snapshot.test.ts";

import "./version-control/blob/version-control-blob-framing.test.ts";
await import("./version-control/protocol/version-control-prefix-integrity.test.ts");
await import("./version-control/pending/version-control-pending-target.test.ts");

await import("./version-control/protocol/version-control-fingerprint-demand.test.ts");

await import("./version-control/revision/version-control-scoped-payload.test.ts");
await import("./version-control/revision/version-control-scoped-payload-integrity.test.ts");

import "./version-control/pending/version-control-pending-delta.test.ts";

import "./version-control/blob/version-control-blob-write.test.ts";
import "./version-control/blob/version-control-blob-write-failure.test.ts";
