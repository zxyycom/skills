# 日志 schema v2 → v3

本记录只覆盖需要保留历史的 v2 日志；无需历史时直接[重新建库](../../references/call-logging.md#不保留历史重新建库)。正常推理、stats 与 updater 均不迁移旧库，也不重放请求。

| 项目 | 内容 |
| --- | --- |
| 来源 | `application_id = 1246058033`、`user_version = 2`，UTF-8 编码的固定 v2 calls 表与索引 |
| 目标 | `user_version = 3`，增加 `adapter_contract` 与 `carrier_json` 两个可空 TEXT 字段 |

## 字段映射与来源

原 v2 全部列、索引、调用 ID、状态、时间、usage、NULL、request_json 文本与 response_body BLOB 原样保留，不重算既有字节或费用。

| 新字段 | 标准迁移 | 后续含义 |
| --- | --- | --- |
| `adapter_contract` | NULL | 未知实际 wire／转换合同；不能按 endpoint、model、正文形状或当前配置猜测为默认 JEV |
| `carrier_json` | NULL | 未另存统一载体；可信直通 JEV 的原 request_json 可承担原问题来源，无需复制同一正文；没有正文不复造 |

只有可信 writer／调用来源证明相应记录采用哪个合同后，才可另行按调用 ID 回填版本化身份。证明整库来自已知旧 JEV writer 时可显式赋 `openrouter-systemone/v1`；依据是 writer，而不是 URL。混合库须外部唯一映射，每条恰好命中一行，未知或重复 ID 拒绝；没有证据就保持 NULL。标准 SQL 不执行这种额外回填。

NULL 合同不妨碍当前 stats 按已有摘要计数，但它是独立未知层，具体合同筛选不命中。旧 succeeded 只保留原技术状态，不证明已知全部 answered。离线采用历史响应须先恢复合同和原问题，再按[恢复边界](../../references/call-logging.md#恢复与只读核对)复验；迁移成功不等于答案已验证。

## 执行与验证

[migrate.sql](migrate.sql) 仅适用于上述已知原始 v2 结构；结构被改写、其他应用、未知版本或损坏库停止，不只改 user_version 冒充升级。

1. 确认目标副本、数据留存和切换授权，停止目标库写入。以 SQLite 备份能力在尚不存在的私有路径建立副本，包含已提交 WAL；保留原库及旁文件，不复制活跃主文件代替备份。文件／父目录维持私有权限。
2. 在副本确认 application_id、user_version、UTF-8 encoding、固定列／索引与 `PRAGMA integrity_check`，记录行数、ID 集合及原有列／BLOB 的比较依据；正文比较仅在私有环境完成。
3. 用遇错即停的客户端在副本执行脚本（路径均为占位）：

   ```bash
   sqlite3 -bail /absolute/private/calls-v3.sqlite3 \
     < /absolute/path/lightweight-judgment/migrations/log-v2-to-v3/migrate.sql
   ```

4. 确认版本为 3、完整性正常、原行数／ID／全部旧列逐值不变，特别是 BLOB、NULL、状态和更新时间；两个新增字段全为 NULL。脚本失败时停止，在新备份副本调查，不续用状态未知的中间结果。
5. 用支持 v3 的 CLI 运行 `stats --database /absolute/private/calls-v3.sqlite3 --group-by adapterContract`，须退出 0；核对旧指标与调用数不变、合同为 null 层。仅在全部验证后切换 `logging.databasePath` 并恢复写入，保留原库作为回退依据；已有新调用的副本不得被旧库覆盖。

v1 历史先按 [v1→v2](../log-v1-to-v2/README.md) 的来源与回填规则转换，再按本文处理。真实库迁移是独立用户操作，工具升级本身不提供该授权。
