CREATE TABLE metadata (
  root TEXT NOT NULL, id TEXT NOT NULL, schema_version INTEGER NOT NULL
) STRICT;
CREATE UNIQUE INDEX metadata_singleton ON metadata((1));

CREATE TABLE units (
  id TEXT PRIMARY KEY,
  current_version INTEGER NOT NULL CHECK (current_version > 0),
  state TEXT NOT NULL CHECK (state IN ('active','pending','disabled','hidden','superseded','completed','cancelled')),
  FOREIGN KEY (id,current_version) REFERENCES versions(id,version) DEFERRABLE INITIALLY DEFERRED
) STRICT;
CREATE TABLE versions (
  id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  generation INTEGER NOT NULL CHECK (generation > 0),
  kind TEXT NOT NULL CHECK (kind IN ('knowledge','intent')),
  title TEXT NOT NULL, body TEXT NOT NULL, source TEXT NOT NULL,
  conditions TEXT NOT NULL, reason TEXT NOT NULL,
  PRIMARY KEY(id,version),
  UNIQUE (id,version,generation)
) STRICT;
CREATE TABLE tags (
  id TEXT NOT NULL, version INTEGER NOT NULL, tag TEXT NOT NULL,
  PRIMARY KEY(id,version,tag),
  FOREIGN KEY (id,version) REFERENCES versions(id,version) ON DELETE CASCADE
) STRICT;
CREATE INDEX tags_by_value ON tags(tag);
CREATE TABLE edges (
  id TEXT NOT NULL, version INTEGER NOT NULL,
  target TEXT NOT NULL, target_version INTEGER NOT NULL, target_generation INTEGER NOT NULL CHECK (target_generation > 0),
  type TEXT NOT NULL CHECK (type IN ('composition','supports','limits','conflicts','replaces','splits')),
  role TEXT NOT NULL,
  PRIMARY KEY(id,version,target,type),
  FOREIGN KEY (id,version) REFERENCES versions(id,version) ON DELETE CASCADE,
  FOREIGN KEY (target,target_version,target_generation) REFERENCES versions(id,version,generation)
) STRICT;
CREATE INDEX edges_reverse ON edges(target,type);
-- Request keys are digests so user-supplied identifiers cannot retain purged text.
CREATE TABLE requests (
  request_key TEXT PRIMARY KEY CHECK (length(request_key) = 64), fingerprint TEXT NOT NULL, result TEXT NOT NULL,
  affected TEXT NOT NULL CHECK (json_valid(affected))
) STRICT;
CREATE TABLE revoked_requests (request_key TEXT PRIMARY KEY CHECK (length(request_key) = 64)) STRICT;
