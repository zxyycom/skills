# 日志 schema v1 → v2

本记录只覆盖**需要保留历史数据**的日志库 schema v1 → v2 转换；不需要历史时直接[重新建库](../../references/call-logging.md#不保留历史重新建库)。版本含义与记录约定见[迁移目录](../README.md)。

| 项目 | 内容 |
| --- | --- |
| 来源 | `application_id = 1246058033`、`user_version = 1` 的原始调用日志；19 个既有字段 |
| 目标 | `user_version = 2`；增加 5 个本地元数据／字节数字段与批次唯一索引 |

## 字段映射与回填规则

原有 19 列，包括调用 ID、状态、时间、留存开关、正文和用量，均原样保留。新增字段按下表转换，缺少来源时保持 SQL NULL：

| 新字段 | 来源与转换 | 值的含义 |
| --- | --- | --- |
| `request_bytes` | `request_json` 非 NULL 时，取原始文本的 UTF-8 字节数，保持文本原样 | 与新调用的请求正文长度口径一致；NULL 表示未知 |
| `response_bytes` | `response_body` 非 NULL 时，取原始 BLOB 的字节数，包括完整的错误响应及无效 UTF-8／JSON | 空 BLOB 为 `0`；NULL 表示未知 |
| `run_id` | v1 无此元数据；仅可来自按调用 ID 对应的外部批次记录 | NULL 表示批次未知，该调用不参与已知批次的首条对照 |
| `run_index` | 外部记录证明的原指定批内位置，与 `run_id` 成对回填 | NULL 表示位置未知；保留原指定序号 |
| `local_tags` | v1 无此元数据；仅可来自按调用 ID 对应的外部标签记录 | NULL 表示未记录，不等于已知无标签的 `{}`；标签筛选不命中具体值 |

字节数从实际留存的非 NULL 原文确定性计算；留存开关、调用状态、tokens 或当前配置不能替代原文。脱敏、截断、重排或重新编码后的内容须另核对来源，不能用改写后的长度冒充原始长度。请求在发送前留存，响应也可能未通过校验，因此字节数只证明长度，不证明发送或成功状态。迁移不重放请求。

外部批次／标签映射的回填需另行确认范围，并在副本上按唯一调用 ID 更新：每条映射恰好命中一行，未知或重复 ID、批次位置冲突和非法值均停止；字段按[本地元数据契约](../../references/statistics.md#记录本地批次与标签)校验。正文同名字段、时间顺序和行号不能替代映射。没有映射时保留 NULL，历史调用仍计入总数，只缺少相应的批次或标签信息。

## 可选：使用附带 SQL

[migrate.sql](migrate.sql) 适用于上述已知 v1 结构、UTF-8 编码且正文未经改写的库。它只在目标副本中新增字段、回填字节数、创建索引并更新版本，三个本地元数据字段保持 NULL。备份、配置切换与文件清理由使用者执行；其他来源按[来源或脚本不适用](#来源或脚本不适用)处理。

### 准备副本

1. 确认目标副本和配置切换的授权、库的来源及可用空间，停止访问目标库的所有写入进程。
2. 使用具备 SQLite 备份能力的客户端，将原库备份到一个尚不存在的私有路径；备份会包含已提交 WAL 数据。保留原库及其旁文件，不用普通文件复制代替活跃 SQLite 备份。
3. 确认副本的 `PRAGMA application_id` 为 `1246058033`、`PRAGMA user_version` 为 `1`、`PRAGMA encoding` 为 `UTF-8`，且 `PRAGMA integrity_check` 返回 `ok`。其他编码须使用能按 UTF-8 编码原文本的转换实现，不能移除编码检查；已是 v2 时跳过本次转换。
4. 记录升级前调用数、调用 ID 集合及两类正文各自的非 NULL 数量，它们是标准回填的预期覆盖数；涉及正文的核对只在私有环境内进行。副本和父目录分别保持私有文件与目录权限。

例如在有 `sqlite3` 客户端的 POSIX shell 中执行备份；路径均为占位，副本路径须事先确认不存在。`.backup`、`-readonly` 与下方 `-bail` 用法见 [SQLite CLI 官方说明](https://www.sqlite.org/cli.html)：

```bash
umask 077
sqlite3 -readonly /absolute/private/calls-v1.sqlite3 \
  ".backup '/absolute/private/calls-v2.sqlite3'"
```

其他平台使用等价的 SQLite 备份与私有权限操作。

### 执行转换

满足上述条件后，用遇错即停止的客户端在副本上执行：

```bash
sqlite3 -bail /absolute/private/calls-v2.sqlite3 \
  < /absolute/path/lightweight-judgment/migrations/log-v1-to-v2/migrate.sql
```

身份／编码检查失败或任何语句报错时停止；交互式连接执行 `ROLLBACK`，不要继续到 `COMMIT`。

全部修改在同一事务内完成。请求文本先在 UTF-8 库中转为 BLOB，再用 `length` 取字节数；直接 `length(TEXT)` 得到的是字符数。SQLite 的[长度函数](https://www.sqlite.org/lang_corefunc.html#length)和[类型转换](https://www.sqlite.org/lang_expr.html#castexpr)说明了这一差异。

### 验证并切换

1. 在副本上重新执行 `PRAGMA integrity_check`，确认版本为 2、调用数和 ID 集合未变，原有列及正文逐值保留，尤其不因回填改变状态或更新时间。
2. 核对每个新增字段：两类字节数的非 NULL 数分别等于对应正文的非 NULL 数，缺失保持 NULL、空响应为 0；抽查多字节请求按 UTF-8 编码后的长度，以及响应 BLOB 长度。未使用外部映射时，批次 ID／序号／标签应全部为 NULL；使用映射时，核对命中数、成对性、唯一性及字段约束。
3. 用支持目标 schema v2 的 CLI 严格检查副本结构并读取统计，命令须退出 0；核对旧字段统计与字节指标的有效／缺失数量：

   ```bash
   node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs stats \
     --database /absolute/private/calls-v2.sqlite3
   ```

4. 确认目标 CLI 接受 v2 且验证成功后，将 `logging.databasePath` 改为副本路径并恢复写入；若目标版本更高，先按迁移目录完成对应转换。切换失败时停止写入并保留两份数据；已有新调用的副本不得被旧库覆盖。
5. 原库作为回退依据保留，待副本数据和后续写入均确认后，按使用者的保留策略另行清理。

## 来源或脚本不适用

- 未知版本、结构被修改或数据损坏：保留原库，核对来源并制定针对性的导出、修复或转换步骤；不要只改 `user_version` 冒充升级。
- 已知 v1 的迁移失败：保持原库不变，在副本上检查权限、锁、空间和具体 SQL 错误。重新尝试时从原库制作新的私有副本，避免继续使用状态未确认的半成品。
- 暂时无法迁移但需要继续留存新调用：显式把配置改为一个尚不存在的新日志路径，让正常推理创建当前格式的库。旧数据继续单独保存，尚不能用当前 `stats` 统计，也不会自动并入新库。
