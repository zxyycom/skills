-- 仅用于已验证的 UTF-8 v1 日志副本；执行前阅读随包迁移记录。
-- 通过遇错即停止的 SQLite 客户端执行；失败时回滚，不继续提交。
BEGIN IMMEDIATE;
CREATE TEMP TABLE upgrade_guard (ok INTEGER NOT NULL CHECK(ok = 1));
INSERT INTO upgrade_guard
SELECT (SELECT application_id FROM pragma_application_id) = 1246058033
   AND (SELECT user_version FROM pragma_user_version) = 1
   AND (SELECT encoding FROM pragma_encoding) = 'UTF-8';

ALTER TABLE calls ADD COLUMN run_id TEXT;
ALTER TABLE calls ADD COLUMN run_index INTEGER;
ALTER TABLE calls ADD COLUMN local_tags TEXT;
ALTER TABLE calls ADD COLUMN request_bytes INTEGER;
ALTER TABLE calls ADD COLUMN response_bytes INTEGER;
UPDATE calls
SET request_bytes = length(CAST(request_json AS BLOB)),
    response_bytes = length(response_body);
CREATE UNIQUE INDEX calls_run_index ON calls(run_id, run_index)
  WHERE run_id IS NOT NULL;
PRAGMA user_version = 2;
DROP TABLE upgrade_guard;
COMMIT;
