# 调用日志

本文承接可选 SQLite 调用记录的配置、留存、状态、恢复与 schema 兼容。离线统计参数和口径由[统计契约](statistics.md)承接。日常命令、输出和存储失败的退出 4 处理由 [CLI 操作契约](cli.md) 承接。

## 开启与留存

日志默认关闭；在选中的 CLI 配置文件设置 `logging.enabled: true` 后启用。每次 CLI 仍直接发送单次请求，记录用于核对与分析，不构成队列或自动重放机制。

| `logging` 字段 | 默认值与含义 |
| --- | --- |
| `enabled` | `false`；关闭时推理不创建或访问数据库；stats 可只读历史库 |
| `databasePath` | 用户目录下 `.local/share/lightweight-judgment/calls.sqlite3`；支持 `~/`，相对路径以选中配置文件所在目录为基准 |
| `saveRequest` | `false`；开启时保存实际发送的完整 JSON 正文，包含补齐／覆盖后的 model，保留原生类型与键顺序；不保留输入文件的原始空白 |
| `saveResponse` | `true`；保存完整收到的 fetch 响应正文原始字节，包括成功响应、非 2xx 正文及无效 UTF-8／JSON，不保存响应头 |

正文开关只在日志启用后生效。记录始终包含 ID、UTC 起止／更新时间、endpoint、请求／响应模型、问题数、留存开关、HTTP 状态、错误类别和耗时。schema v2 另保存本地 run ID／index／tags 与实际请求／完整响应字节数，不依赖正文留存开关；元数据参数见[统计契约](statistics.md#记录本地批次与标签)。仅对有效响应提取服务提供的非负 `input_tokens`、`output_tokens`、`cost`；缺失或无效值保存为 SQL NULL，不估算费用。

未完整收到的响应正文保存为 SQL NULL。非 2xx 响应已确认的 HTTP 错误和 `retryAfterMs` 不因正文读取失败或超时被覆盖；记录仍为 `failed`，保留 `http_status` 与 `error_kind`。正文接收失败本身不是数据库写入失败，`meta.persistence` 仍按实际写入结果报告。

CLI 不将错误消息、配置全文、API key 或鉴权头写入库。启用正文留存时按原内容保存，不替换其中的敏感内容；调用者放入正文或服务回显的敏感信息也可能被保留。开启前应确认两项正文开关及留存权限。

## 数据库位置与写入

仅真实推理通过输入、元数据和凭据校验后创建缺失的父目录与数据库；`help`、`doctor`、`dry-run` 均不访问数据库。

- 使用私有本地文件系统，不使用网络共享盘。新目录按 POSIX `0700`、数据库按 `0600` 创建；已有目录权限由使用者维护。
- 已有非私有文件、符号链接、其他应用的库或不支持的版本会被拒绝，不覆盖或修正它们。
- 每次调用生成独立 UUID，写入 SQLite `calls` 表。WAL、`synchronous=FULL` 和最长 5 秒锁等待支持本机多个 CLI 进程追加；每次记录更新原子提交。初始化 WAL 切换时，仅 SQLite BUSY 可在单个 5 秒预算内等待，确认返回 WAL 后继续；其他初始化错误直接失败。记录库准备完成是发送前置，数据库锁等待不重发 HTTP。

## Schema 兼容

当前写入 schema v2 保留 `calls` 的既有列，增加可空 `run_id`、`run_index`、`local_tags`（JSON 对象文本）、`request_bytes`、`response_bytes`。同一库内 `run_id` 非 NULL 时以唯一索引约束 `(run_id,run_index)`；CLI 保证两项成对、index 为正整数。

启用日志的真实调用在发送前，将受支持的 v1 库事务性升级到 v2；原数据保留，旧记录的新增列为 SQL NULL，不从正文反推字节／标签／批次。新库直接初始化为 v2。`stats` 只读兼容 v1 与 v2；未知版本或不符固定 schema 均拒绝。关闭日志的推理不访问库；只读统计不触发升级。

## 调用状态

发送意图提交成功后才调用 HTTP；收到完整正文后，在协议解析和 stdout 输出前更新记录，最后提交成功或失败状态。

| `status` | 可证明的含义 |
| --- | --- |
| `started` | 发送意图已提交；可能仍执行、尚未发送或已发送后中断，不能据此认定服务未处理 |
| `response_received` | 完整正文已接收并更新记录，但最终校验／状态尚未提交；正文是否留存取决于 `saveResponse` |
| `succeeded` | 响应通过协议校验且最终记录已提交，不代表业务答案一定正确 |
| `failed` | 已记录 HTTP 或协议失败，`error_kind` 区分原因 |
| `indeterminate` | 已记录超时或网络失败，远端是否处理完成可能未知 |

数据库的 `status` 表达调用进度；输出中的 `meta.persistence.status` 表达本次写入是否完整成功，两者按 `callId` 关联。存储失败时先按 [CLI 技术失败](cli.md#技术失败) 保留当前输出，再检查记录。

## 恢复与只读核对

已提交的记录独立于原 CLI 进程存活，可由新进程使用已有 SQLite 工具只读查询。进程强制终止后，恢复按以下边界处理：

1. 结合进程和服务状态核对不完整记录；“没有完成记录”不构成安全重发依据。CLI 不自动重试或重放，也不保证远端恰好处理一次。
2. 需要采用 `response_received` 的正文时，取得完整原请求，按[响应校验契约](cli.md#输出与校验)离线验证并关联原问题，再进入语义复核；`saveRequest: false` 时需另有原请求来源。
3. 当前 CLI 没有校验已有响应的离线命令。缺少原请求或可用的离线校验手段时，停在“已取回记录／正文，答案尚未验证”，说明缺口；`json`／`ask` 的正式调用会发送新请求，不能代替恢复校验。
4. 未收到或未提交的响应无法恢复；无效正文按 BLOB 检查，不假定能转换为文本。持久性依赖 SQLite 与底层存储；进程终止测试不证明断电或介质损坏时仍可恢复。

日常一键统计使用 `stats`，按[统计契约](statistics.md)选择时间／型号／标签和批次对照。需要核对具体记录时，可通过 SQLite 客户端以只读方式打开配置中的数据库路径后执行以下查询：

```sql
-- 待核对的未完成或远端结果不确定的调用
SELECT id, started_at, status, http_status, error_kind
FROM calls
WHERE status IN ('started', 'response_received', 'indeterminate')
ORDER BY started_at;

-- 已成功调用的可选正文；关闭对应留存开关时该列为 NULL
SELECT id, request_json, CAST(response_body AS TEXT) AS response_json
FROM calls WHERE status = 'succeeded' ORDER BY started_at DESC LIMIT 20;
```

## 数据维护

数据保留期限、清理和容量管理由使用者负责，CLI 不自动删除记录。制作分析副本时使用 SQLite 备份能力，或待全部写入进程停止并完成 checkpoint 后复制；不要只复制活跃库的主文件而遗漏 WAL。
