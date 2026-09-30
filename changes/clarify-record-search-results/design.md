# Design

共享搜索提供匹配与覆盖事实，两个记录域补充实际参数和数据来源，CLI 从同一结果生成短摘要。

## Context

[决策查询规则](../../skills/decision-records/references/decision-record-rules.md#派生索引与查询)与[调查查询契约](../../skills/investigation-report/references/investigation-report-contract.md#索引与查询)已定义索引、正文、降级与截断边界；本 Change 将这些事实显式交付给调用方。

| 当前实现 | 相关行为 |
| --- | --- |
| Decision search | 默认 active、全部 alignment；metadata 完整返回。content 固定最多返回 20 个文件、每文件预览 3 个命中范围、总预览 12,000 字符。 |
| Investigation search | 只查正式报告，可按 tag、形成时间和关系筛选；limit 默认 50、最大 1000。content 每文件预览 3 个命中范围、总预览 24,000 字符。metadata 完整匹配后切片，但未标记返回限制。 |
| 共享全文搜索 | 两域调用 `tools/shared/src/file-text-search/index.ts`；记录预算和预览字符预算会停止扫描，仅命中范围预览受限时继续扫描。 |

[权威文件搜索决策](../../docs/decisions/search-authoritative-files-with-index-identity.md)确定共享层承接文件事实、领域按同一快照映射身份；[关系摘要消费决策](../../docs/decisions/separate-relation-summary-consumption-by-reading-task.md)确定文本证据、筛选依据和公开 API 边界。

## Goals / Non-Goals

目标是让两个记录域的搜索直接回答“如何搜索、依据什么、命中与返回多少、哪些部分完整”，保留原有记录展示与有界查询。

范围限于两个 `search` 及必要共享适配。Test Evidence 的搜索修复独立留待后续；其他命令保持现状。现有查询入口和索引继续使用，本 Change 不增加分页、搜索服务、持久全文索引、通用 SDK、全局 envelope 或重复操作指引。计划描述方案与任务，实施和结项按当次授权执行。

## Decisions

### Intended Change

#### 查询元信息

两域采用共同语义，保留各自的结果类型。以下字段名表达语义，具体 TypeScript 组织在 Readiness 收敛。

| 信息 | 定义 |
| --- | --- |
| Query / Filters / Limits | 本次校验、默认值应用和 selector 解析后的文本、in、match、领域筛选和实际预算；关系目标回显解析后的完整 ID。 |
| Source | 来源为 `published-index` 或 `validated-source`；currentness 为 `current`、`stale` 或 `unchecked`，并标明是否只读降级。取值依据实际核对证据。 |
| Counts | matched 包含非负整数 value 与 `exact` / `lower-bound` 精度，计入已发现但受返回预算限制的命中；returned 是实际返回记录数。 |
| Coverage | scanComplete、resultsComplete、正文 previewsComplete 分别说明扫描、返回和预览覆盖，并给出限制原因；metadata 的正文预览为不适用。 |

1. scanComplete 针对本次结构筛选后的匹配集合。检查完毕时 matched 为 exact；提前停止时为已观察命中的 lower-bound。
2. resultsComplete 要求扫描完整、计数精确且全部命中均已返回；预览覆盖独立判断。
3. 完整空集返回 exact 0。陈旧索引的数量和覆盖仅代表该快照；来源核对只对应本次取得的证据。
4. 读取失败、资源错误和取消沿用 failure、诊断与退出码；成功摘要只用于成功查询。

#### 搜索行为

metadata 保留已计算的精确命中数。Decision 保持完整返回；Investigation 使用切片前的 matched、切片后的 returned，并在隐藏命中时标记返回限制和 warning。

两个记录域显式选择预览仅限制展示的行为：命中范围或字符预算耗尽后，在剩余扫描资源和返回预算内继续识别文件；即使片段为空，也保留已确认的命中身份与计数。

返回记录预算仍可使搜索有界停止，此时报告下界与扫描限制。覆盖由实际匹配过程产生；最后一个候选文件触发返回限制时，扫描可能已经完整，应按实际检查进度判断。

#### 默认输出

stdout 在原有记录之前输出 Query、Filters、Source、适用 Limits、Counts、Coverage。CLI 消费已完成的领域查询结果；英文输出风格与现有 CLI 一致。warning 分别说明返回限制、预览限制和来源降级，保留 stdout/stderr 分工及现有 JSON 入口。

下表是语义示例，精确文字在 Readiness 收敛：

| 情况 | 数量 | 覆盖 |
| --- | --- | --- |
| metadata 全部匹配、限量返回 | matched=11 exact；returned=1 | 扫描完整，返回受限，正文预览不适用。 |
| content 提前停止 | matched≥21 lower-bound；returned=20 | 扫描与返回不完整，预览单独报告。 |
| content 仅片段受限 | matched=2 exact；returned=2 | 扫描与返回完整，预览受限。 |

### Resulting Impacts

1. **公开边界**：Investigation 的运行时结果、`types.ts`、`api/` 声明 owner 与生成制品一起对齐，保留现有字段和错误类型。Decision 的元信息留在现有内部查询边界；两域索引和记录字段保持不变。
2. **共享兼容**：`tools/test-evidence/src/core-search.ts` 也是消费者。本 Change 为两个记录域选择显式策略或局部入口，保持 Test Evidence 的默认调用、公开契约和行为。若共享实现必然引起该领域的运行时、声明或版本承载变化，先收窄方案，无法收窄时取得范围授权；纯调试生成影响按工具链核对。
3. **交付与证据**：在 `tools/` 修改源码，通过 `sync:decision-records-cli`、`sync:investigation-report-check` 更新分发。两域查询 owner 承接完整解释，SKILL.md 与 help 保留必要入口信息；测试按最小原生入口维护 Case，版本按承载变化提升。长期决策按实际边界变化判断记录门槛。

## Risks / Trade-offs

- 预览解耦可能增加读取量；保留文件与请求字节上限、返回预算，有界停止继续是合法结果。
- 新增 Investigation 公共字段需要核对合法类型组合、声明与程序化消费者；兼容证据属于 Readiness 和 Verification。
- 查询覆盖与外层工具的输出展示是不同边界。整体预览字符预算不是 stdout 字节上限，外部 UI 仍可能截断输出。

## Open Questions

实施前由 Readiness 收敛三项局部选择：

1. 元信息的 TypeScript 结构、成功/失败组合、selector 回显与 Investigation 声明生成边界。
2. 预览解耦的最小显式策略，以及共享消费者和生成边界的兼容证据。
3. stdout 摘要、metadata 预览不适用及 warning 的精确表示。

会扩大领域范围或改变已确认 Outcome 的选择，再取得相应授权。
