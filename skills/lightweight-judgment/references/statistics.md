# 离线调用统计

用 `stats` 汇总已有日志的用量与客户端耗时，按模型、状态、标签分层或对照批次首条。本文承接参数、输出、统计口径与只读边界；记录开启、正文留存和 schema 兼容由[调用日志](call-logging.md)承接，输出 envelope 与退出码由 [CLI 操作契约](cli.md)承接。

## 取得统计

1. 选择已有的私有日志库：使用配置中的路径，或显式指定 `--database`。
2. 按比较目标筛选记录，再选择分组、数值分桶与百分位数。
3. 检查退出码与 `ok`，成功后先核对调用数、指标覆盖与批次完整性，再解读分布。

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs stats
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs stats --database /absolute/private/calls.sqlite3
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs stats \
  --database /absolute/private/calls.sqlite3 \
  --from 2026-10-01T00:00:00Z --to 2026-10-02T00:00:00Z \
  --group-by requestModel,status,tag:suite \
  --bucket requestBytes=1000,5000 --bucket inputTokens=100,1000 \
  --percentiles 50,90,95,99
```

以上路径、时间窗口、标签和分桶值均为示例，按实际数据与比较目标替换。

| 选库方式 | 行为 |
| --- | --- |
| `stats` 或 `--config <path>` | 按 CLI 配置选择规则解析 `logging.databasePath`；`logging.enabled: false` 时仍可读历史库，不要求密钥存在 |
| `--database <path>` | 完全跳过配置读取，与 `--config` 互斥；相对路径基于当前工作目录，`~/` 基于用户目录展开 |

stdout 为 `{ ok, result, meta, error }`，`meta.attempts: 0` 且无 `meta.persistence`。成功退出 0，没有匹配记录是成功空集；参数错误退出 2，库／统计失败为 `storage`、退出 4。失败不会返回空集或截断结果冒充统计；超出预算时缩小筛选范围或显式提高预算。

## 筛选、分组与分桶

| 参数 | 规则 |
| --- | --- |
| `--from` / `--to` | UTC `YYYY-MM-DDTHH:mm:ss[.sss]Z`，按记录 `started_at` 筛选，窗口为 `[from,to)`；可只给一端，两端同时给时须 from < to |
| `--endpoint` | 精确匹配已记录的完整 endpoint，不做 URL 归一化或模糊匹配 |
| `--request-model` / `--response-model` | 精确匹配请求标识／实际响应型号，不把别名合并 |
| `--status` | `started`、`response_received`、`succeeded`、`failed`、`indeterminate` 之一 |
| `--run-id` | 精确匹配批次 ID；无批次元数据的记录不匹配 |
| `--tag key=value` | 可重复，精确 AND 匹配；键值规则见[本地元数据](#记录本地批次与标签)，缺标签不匹配 |
| `--group-by` | 逗号组合 `endpoint,requestModel,responseModel,status,errorKind,runId,tag:<key>`；最多 8 个唯一字段；缺值独立为 null，不并入字符串 `"null"` |
| `--bucket field=b1,b2` | 可重复，每字段一组、每组最多 100 个非负有限且严格递增边界；字段为 `elapsedMs,inputTokens,outputTokens,requestBytes,responseBytes,questionCount` |
| `--percentiles` | 默认 `50,90,95,99`；最多 100 个严格递增、>0 且 <=100 的百分位数 |
| `--max-rows` | 默认 100000，正安全整数；完整所选摘要行数超限即失败。内存随摘要行数与分组增长，不载入正文 |

所有筛选组合为 AND；默认保留失败和重复真实调用。筛选值通过 SQL 参数绑定，分组／指标只接受表中字段，不接受任意 SQL。

分桶区间为 `[-∞,b1)`、`[b1,b2)`、…、`[bn,+∞)`，输出 `lowerInclusive`／`upperExclusive`（无界为 null）；缺值单列 `missing`，不进入零值桶。

## 输出与统计口径

`result` 包含 `database`、`schemaVersion`、口径说明 `method`、归一化 `filters`、`percentiles`、`groupBy`、全体所选记录的 `summary`、分层 `groups` 与 `batchComparison`。本文将“所选记录集合”称为 cohort。每个已有组返回 `key` 和同口径 summary；没有分组时 `groups` 为 `[]`。

### 覆盖与分母

- `summary.calls` 是调用条数，不是题目数；`statuses` 分列调用状态，`errors` 按已有 `error_kind` 计数。`unfinished` 只计 `started` 与 `response_received`；`indeterminate` 单列，不能据此认定未发送。
- `metrics` 含耗时、input/output tokens、请求／响应字节数和问题数。每项提供有值 `count`、`missing`、`sum`、`mean`、`min`、`max` 和所选 `percentiles`；SQL NULL 不等于 0，全缺失或空 cohort 的 sum／mean／极值／分位数均为 null。
- 统计只覆盖已留存调用；日志关闭时的调用没有样本。没有 gold／人工判定就不输出准确率或质量评分；协议成功、高 confidence、重复同答均不代替正确性。

分位数固定 **nearest-rank**：n 个有值样本升序排列后，取 1-based 第 `ceil(p/100*n)` 个，算法由 `method.quantiles` 明示。P50 不是偶数样本中间两项的平均：`[300,1000]` 的 P50 是 300，而非 650。

### 指标含义

| 指标 | 解读边界 |
| --- | --- |
| `inputTokens` / `outputTokens` | 有效响应的服务报告、请求级 usage；一条多题请求只累计一次。失败或未上报时保留缺失，不按题数放大或估算 |
| `reportedCostByEndpoint` | 始终按接收方隔离费用覆盖与分布，单位为 `service-reported-unspecified`；不提供跨 endpoint 无条件总费用，不假定货币、价格或跨服务可比性 |
| `requestBytes` | 补齐／覆盖模型后实际发送 JSON 的 UTF-8 字节数 |
| `responseBytes` | 完整收到响应的实际字节数；无完整响应时为 null |
| `elapsedMs` | 发送前计时器启动，至完整响应接收、协议校验／失败处理完成且最终日志 finish 开始前的整数毫秒；启用日志时可包含中间接收记录写入，不含配置／输入／凭据前置及最终落盘／stdout |

字节数独立于正文留存开关；旧记录没有新增字节元数据时为 null。`elapsedMs` **不是完整 CLI 进程耗时、纯推理耗时或 TTFT**，非流式日志也不能推算 TTFT。

数量、tokens、字节和耗时为安全非负整数；总和超安全整数或浮点聚合非有限时明确失败，不静默舍入。服务报告 cost 沿用有限非负浮点数，不新增货币精度承诺。

## 记录本地批次与标签

需要后续批次对照时，在已获授权的 `json`／`ask` 调用中提供本地元数据；它们保存到启用的日志，不进入 HTTP 请求。以下批次 ID 与标签仅为示例，实际值由当前比较目标确定：

```bash
node /absolute/path/lightweight-judgment/scripts/lightweight-judgment.mjs json \
  --file /absolute/path/request.json --run-id batch-20261001 --run-index 1 \
  --tag suite=classification --tag variant=original
```

| 参数 | 校验与留存 |
| --- | --- |
| `--run-id` / `--run-index` | 成对提供；ID 为 1–128 字符且无空白／控制字符，index 为从 1 开始的安全正整数。同一库内 ID／index 唯一；冲突在发送前以 storage 失败，另一次调用需显式选下一 index 或新 ID，不自动改号 |
| `--tag key=value` | 最多 32 个唯一键，按首个等号分隔；键匹配 `[A-Za-z_][A-Za-z0-9_.-]{0,63}`，值为 1–256 字符且无控制字符 |

非法元数据在发送／建库前拒绝；日志关闭时不留存，dry-run 仍验证但不访问库。新记录的元数据与字节数不依赖正文留存；v1 或升级前旧记录的缺失项不从正文补推。

## 批次首条对照

首条固定指调用方明确标记的 **run index 1**；index 不是日志时间排序，不推断并发下真实发出顺序，也不证明冷启动、连接复用或因果关系。

`batchComparison.batches` 按 run ID 返回：

| 字段 | 含义与分母 |
| --- | --- |
| `selectedCalls` / `totalCalls` / `partial` | 当前所选调用数／整个库内该 run 的调用数／是否局部批次。被筛除记录只作计数上下文，不进入指标 |
| `firstState` / `first` | 首条状态为 `measured`、`missing`（原库无 index 1）、`filtered`（原库有但本次排除）、`unfinished`、`missing_elapsed` 或 `ambiguous`；`first` 含所选 index 1 的 ID、状态、型号、接收方和已有耗时，没有时为 null，不以最早所选记录补位 |
| `selectedLaterCalls` / `laterMeasuredCalls` / `laterP50Ms` | 后续所选数／有可用耗时的后续数／nearest-rank P50。耗时只取所选 index >1、已结束且有值的调用，包含 failed／indeterminate，排除未完成 |
| `firstMinusLaterP50Ms` / `firstOverLaterP50` | 首条已结束且有耗时、后续有值时给差值（首条减后续 P50）；后续 P50 >0 时才给倍数，否则倍数为 null |
| `dimensions` | 所选调用的 endpoint／请求模型／响应模型组合；混合型号批次需按比较目标过滤后解读 |

顶层分布的采样单位不同：

- `firstElapsedMs`：每个所选首条至多一项，未完成／缺耗时为缺失；原库缺首条或首条被筛除不进入分布。
- `laterElapsedMs`：所选后续调用级分布，未完成／缺耗时为缺失，非逐批等权。
- 差值与倍数分布：以可比较批次为单位，`comparableRuns` 是差值分母；后续 P50 为零的批次有差值但没有倍数。
- `unbatchedCalls`：无批次信息的旧／新调用仍计入 summary，但不参与首条对照。歧义批次标 `ambiguous`、计入 `ambiguousRuns`，不进入跨批分布或差值／倍数，不静默合并。

`groups` 仅分层 summary；`batchComparison` 基于整个所选 cohort，不为各组复制。按型号或标签比较首条时，重复运行不同离线筛选即可。

## 只读与失败边界

`stats` 只读既有领域数据与 schema，兼容 v1／v2；不创建库或目录、迁移、清理、更新记录或改变 journal 设置。一个只读事务提供一致快照，包含活跃 WAL 已提交数据；SQLite 可参与 WAL／SHM 协调，因此不保证旁文件完全不变，也不使用忽略活跃 WAL 的 immutable 打开方式。

缺库、非私有普通文件、符号链接、其他应用的库、未知版本、schema 不符、读取失败或非法统计数据均失败，与成功空集严格区分。

统计不发送 HTTP、不取环境密钥，不读取或输出库内请求／响应正文及凭据，也不重放或主动复测。统计任务不授权新增服务调用；新样本须另按原任务确认调用范围与费用授权。
