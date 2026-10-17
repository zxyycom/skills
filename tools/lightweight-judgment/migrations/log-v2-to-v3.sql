-- 仅用于已验证的 UTF-8 schema v2 私有副本；执行前阅读随包迁移说明。
-- SQLite 客户端必须遇错停止；失败时显式 ROLLBACK，不继续提交。
BEGIN IMMEDIATE;
CREATE TEMP TABLE upgrade_guard (ok INTEGER NOT NULL CHECK(ok = 1));
INSERT INTO upgrade_guard
SELECT (SELECT application_id FROM pragma_application_id) = 1246058033
   AND (SELECT user_version FROM pragma_user_version) = 2
   AND (SELECT encoding FROM pragma_encoding) = 'UTF-8'
   AND (SELECT COUNT(*) FROM pragma_table_info('calls')) = 24
   AND (SELECT group_concat(name, ',') FROM pragma_table_info('calls')) =
     'id,started_at,updated_at,finished_at,status,endpoint,request_model,response_model,question_count,save_request,save_response,request_json,response_body,http_status,error_kind,elapsed_ms,input_tokens,output_tokens,cost,run_id,run_index,local_tags,request_bytes,response_bytes'
   AND (SELECT strict FROM pragma_table_list WHERE name = 'calls' AND schema = 'main') = 1
   AND (SELECT COUNT(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%') = 4
   AND (SELECT COUNT(*) FROM pragma_index_list('calls') WHERE name = 'calls_run_index' AND "unique" = 1 AND partial = 1) = 1;

INSERT INTO upgrade_guard SELECT (SELECT lower(replace(replace(replace(replace(sql, ' ', ''), char(9), ''), char(10), ''), char(13), '')) FROM sqlite_master WHERE name='calls') = 'createtablecalls(idtextprimarykey,started_attextnotnull,updated_attextnotnull,finished_attext,statustextnotnullcheck(statusin(''started'',''response_received'',''succeeded'',''failed'',''indeterminate'')),endpointtextnotnull,request_modeltextnotnull,response_modeltext,question_countintegernotnull,save_requestintegernotnull,save_responseintegernotnull,request_jsontext,response_bodyblob,http_statusinteger,error_kindtext,elapsed_msinteger,input_tokensinteger,output_tokensinteger,costreal,run_idtext,run_indexinteger,local_tagstext,request_bytesinteger,response_bytesinteger)strict';
INSERT INTO upgrade_guard SELECT (SELECT lower(replace(replace(replace(replace(sql, ' ', ''), char(9), ''), char(10), ''), char(13), '')) FROM sqlite_master WHERE name='calls_started_at') = 'createindexcalls_started_atoncalls(started_at)';
INSERT INTO upgrade_guard SELECT (SELECT lower(replace(replace(replace(replace(sql, ' ', ''), char(9), ''), char(10), ''), char(13), '')) FROM sqlite_master WHERE name='calls_status') = 'createindexcalls_statusoncalls(status)';
INSERT INTO upgrade_guard SELECT (SELECT lower(replace(replace(replace(replace(sql, ' ', ''), char(9), ''), char(10), ''), char(13), '')) FROM sqlite_master WHERE name='calls_run_index') = 'createuniqueindexcalls_run_indexoncalls(run_id,run_index)whererun_idisnotnull';


-- 不由 URL/model 猜测历史 adapter，不复制或重算旧正文、用量、字节与费用。
ALTER TABLE calls ADD COLUMN adapter_contract TEXT;
ALTER TABLE calls ADD COLUMN carrier_json TEXT;
PRAGMA user_version = 3;
DROP TABLE upgrade_guard;
COMMIT;
