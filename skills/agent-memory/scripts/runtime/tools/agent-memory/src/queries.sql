-- name: begin_read
BEGIN;
-- name: begin_write
BEGIN IMMEDIATE;
-- name: commit
COMMIT;
-- name: rollback
ROLLBACK;
-- name: meta
SELECT root, schema_version FROM metadata;
-- name: init
INSERT INTO metadata (root, id, schema_version) VALUES (?, ?, ?);
-- name: head
SELECT u.id, u.current_version, u.state, v.generation, v.kind
FROM units u LEFT JOIN versions v ON v.id = u.id AND v.version = u.current_version
WHERE u.id = ?;
-- name: version
SELECT id, version, generation, kind, title, body, source, conditions, reason
FROM versions WHERE id = ? AND version = ?;
-- name: generation
SELECT generation FROM versions WHERE id = ? AND version = ?;
-- name: tags
SELECT tag FROM tags WHERE id = ? AND version = ? ORDER BY tag;
-- name: edges
SELECT target, target_version, target_generation, type, role
FROM edges WHERE id = ? AND version = ? ORDER BY type, target;
-- name: composition
SELECT target, target_generation
FROM edges WHERE id = ? AND version = ? AND type = 'composition';
-- name: reaches
WITH RECURSIVE reachable(id) AS (
  VALUES (?1)
  UNION
  SELECT e.target FROM reachable r
  JOIN units u ON u.id = r.id
  JOIN edges e ON e.id = u.id AND e.version = u.current_version
  WHERE e.type = 'composition'
)
SELECT 1 AS found FROM reachable WHERE id = ?2 LIMIT 1;
-- name: recall
WITH matches AS (
  SELECT u.id, 0 AS scope_order, clue.key AS clue_order, 'tag:' || clue.value AS reason
  FROM json_each(?1) clue
  JOIN tags t ON t.tag = clue.value
  JOIN units u ON u.id = t.id AND u.current_version = t.version
  WHERE u.state = 'active'
  UNION ALL
  SELECT u.id, 1, clue.key, 'text:' || clue.value
  FROM json_each(?2) clue
  CROSS JOIN units u
  JOIN versions v ON v.id = u.id AND v.version = u.current_version
  WHERE u.state = 'active' AND (instr(v.title, clue.value) OR instr(v.body, clue.value))
)
SELECT m.id, v.conditions,
       json_group_array(m.reason ORDER BY m.scope_order, m.clue_order) AS reasons
FROM matches m
JOIN units u ON u.id = m.id
JOIN versions v ON v.id = u.id AND v.version = u.current_version
GROUP BY m.id
ORDER BY count(*) DESC, m.id;
-- name: affected_units
WITH RECURSIVE affected(id) AS (
  SELECT id FROM units WHERE id = ?
  UNION
  SELECT e.id FROM affected a JOIN edges e ON e.target = a.id
  WHERE e.type = 'composition'
)
SELECT u.id, u.current_version AS version, u.state
FROM affected a JOIN units u ON u.id = a.id ORDER BY u.id;
-- name: removed_references
WITH affected(id) AS (SELECT value FROM json_each(?))
SELECT e.id, e.version, e.target, e.target_version AS targetVersion, e.type, e.role
FROM affected a JOIN edges e ON e.target = a.id
WHERE NOT EXISTS (SELECT 1 FROM affected owner WHERE owner.id = e.id);
-- name: new_unit
INSERT INTO units VALUES (?, 1, 'active');
-- name: update_unit
UPDATE units SET current_version = ?, state = ? WHERE id = ?;
-- name: insert_version
INSERT INTO versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
-- name: insert_tag
INSERT INTO tags VALUES (?, ?, ?);
-- name: insert_edge
INSERT INTO edges VALUES (?, ?, ?, ?, ?, ?, ?);
-- name: close_version
INSERT INTO versions (id, version, generation, kind, title, body, source, conditions, reason)
SELECT id, version + 1, generation + 1, kind, title, body, source, conditions, ?1
FROM versions WHERE id = ?2 AND version = ?3;
-- name: close_tags
INSERT INTO tags (id, version, tag)
SELECT id, version + 1, tag FROM tags WHERE id = ?1 AND version = ?2;
-- name: close_edges
INSERT INTO edges (id, version, target, target_version, target_generation, type, role)
SELECT id, version + 1, target, target_version, target_generation, type, role
FROM edges WHERE id = ?1 AND version = ?2
RETURNING target;
-- name: request
SELECT fingerprint, result FROM requests WHERE request_key = ?;
-- name: insert_request
INSERT INTO requests VALUES (?, ?, ?, ?);
-- name: delete_affected_requests
DELETE FROM requests
WHERE EXISTS (
  SELECT 1 FROM json_each(requests.affected) saved
  JOIN json_each(?) removed ON saved.value = removed.value
)
RETURNING request_key;
-- name: delete_units
DELETE FROM units WHERE id IN (SELECT value FROM json_each(?));
-- name: delete_target_edges
DELETE FROM edges WHERE target IN (SELECT value FROM json_each(?));
-- name: revoked_request
SELECT request_key FROM revoked_requests WHERE request_key = ?;
-- name: revoke_request
INSERT OR IGNORE INTO revoked_requests VALUES (?);
