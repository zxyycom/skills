# Design

源 Markdown 表达事实，索引负责定位和校验，普通列表负责浏览。三者分别定义省写规则，在读取边界恢复完整的领域值。

## Context

决策和调查以完整 ID 为索引键。[定位契约](../../docs/decisions/locate-decisions-through-id-keyed-index.md)将身份与实际位置分开，[版本契约](../../docs/decisions/version-index-definition-compatibility.md)允许定义变化后从来源重建。两域普通输出与机器输出当前共享[查询结果](../../tools/record-cli/protocol.md)；资源 CLI 有[独立协议](../../skills/resource-records/references/cli-operations.md)。

## Goals / Non-Goals

仅省写语义唯一可恢复的值。记录身份、实际分类与对齐状态、哈希未知及其原因、来源指纹和查询覆盖均保留。其他索引、历史 Markdown 批量整理和发布部署不在范围内。

## Decisions

### Intended Change

**源 YAML**

| 对象 | 写入与读取 |
| --- | --- |
| 决策、调查 | 无直接前序时省写 `relations`；读取时与显式 `[]` 等价。有关系时保留完整边。更新命令仍以显式清空表示删除已有关系。 |
| 决策候选 | `status: candidate` 时省写 `alignment` 和 `createdAt`，旧的显式 null 同样有效。建立时写入实际值；活动和归档记录两项均必填。 |
| 资源版本 | 新模板和索引只写非空分支。逻辑版本只有非空 `entries`；文件或图包版本至少有一个非空的 `files` 或 `members`，两者可并存。旧 YAML 的空文件或成员列表可读；显式空 `entries`、分支冲突、三者全无仍报错。文件哈希未知保留 `sha256: null` 及 `gap`。 |

**落盘索引**

- 决策、调查省写 `name`，沿用领域的 ID → 名称规则（含无日期旧 ID）；省写空 `relations`，调查另省写空 `resourceIds`。各命令用还原后的字段执行原有范围的校验。
- 仅在真实位置精确等于默认路径时省写 `sourcePath`：调查和活动决策取 `<完整ID>.md`，归档决策取 `archive/<完整ID>.md`。例外直接保存真实路径；移动与更名后按新位置重新比较。决策索引将条目排在来源指纹表之前。
- 两域升级 `definitionVersion`，保持通用索引格式版本；资源仅提升索引 `schemaVersion`，源记录继续接受版本 1。普通读取拒绝旧索引并提示全量重建。紧凑格式限于持久化边界；包括资源版本在内，机器查询结果仍按各自 CLI 协议序列化。

**列表展示**

决策、调查不带 `--json` 的成功 `list` 继续输出格式化 JSON。基于每个来源的完整发布快照统计标签，筛选和分页只影响命中项。展示时将 `facets.tags` 按记录计数降序、同数按标签名升序取前 10 种；有剩余时以 `facets.omittedTagCount` 给出未展示的**不同标签数**。总数与其余统计沿用各自口径。显式全量入口复用 `list --json`：保留原有字段、全部计数及顺序。

### Resulting Impacts

各 skill 维护自身的领域说明和源模板，机器 Schema 从维护源通过公开入口同步到包内。用新版 CLI 的全量 `sync-index` 就地重建，再用 `check` 核对；来源校验失败保留旧文件。仓库提交的决策、调查索引作为整体换版，资源索引用独立集合验收。

## Risks / Trade-offs

路径省写改变了持久定位契约：实施时按真实后继关系演进既有决策，保留“位置独立于身份”的约束。跨版本时先核对工作区与暂存区的归属；有冲突暂存先停。用授权的整体 Git 快照建立新版 HEAD 后再恢复依赖历史索引的操作，逐条同步或暂存只用于版本匹配的基线。

## Open Questions

无。
