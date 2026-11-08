# 公开入口覆盖地图

## 如何读取

本轮在 2026-11-08 完成 DR（Decision Records）18 个、IR（Investigation Report）14 个业务入口的源码定位和合法私有输入代表核验；help/version 单列。这里汇总实际覆盖，精确源码路径、数据文件及选择器以 [coverage.json](./coverage.json) 为准。它是本轮调查证据，不是长期测试账本。

下表只概括已测代表，不能据此推断所有参数、错误或领域语义均已验证。逐入口未测项在 JSON 的 `branches_not_tested`；独立期望、正常观察、调查错误与限制分别见 [查询说明](../queries/coverage.md)、[图说明](../graphs/coverage.md)、[写入与 Git 说明](../writes/coverage.md)。原始样本保持原样，按 JSON 选择器读取时应区分预期拒绝和脚本准备错误。

## DR：18 个业务入口

| 入口 | 已核验代表 | 切面说明 |
| --- | --- | --- |
| `archive` | 未记录历史拒绝及显式确认后实际归档。 | [writes](../writes/coverage.md) |
| `candidates` | 空候选及 C1/32/250 列举。 | [queries](../queries/coverage.md) |
| `check` | 全量 check；DR 不支持 selected。 | [writes](../writes/coverage.md) |
| `discard` | 候选及正式删除。 | [writes](../writes/coverage.md) |
| `evolve` | 单后继预检与实际发布。 | [writes](../writes/coverage.md) |
| `list` | 页面/空页、tag/RFC3339、关系筛选、状态筛选。 | [queries](../queries/coverage.md) |
| `mark-aligned` | unaligned 到 aligned 实写。 | [writes](../writes/coverage.md) |
| `new` | 真实候选创建。 | [writes](../writes/coverage.md) |
| `publish` | 预检零写与实际发布。 | [writes](../writes/coverage.md) |
| `reactivate` | 预检及正式状态转换。 | [writes](../writes/coverage.md) |
| `rename` | 正式预检/实写/历史门禁、候选更名、真正 no-op。 | [writes](../writes/coverage.md) |
| `search` | metadata 命中/未命中、多匹配模式；content 命中/未命中。 | [queries](../queries/coverage.md) |
| `set-relations` | no-op、预检、正式实写。 | [writes](../writes/coverage.md) |
| `show` | ID/name 及不存在错误。 | [queries](../queries/coverage.md) |
| `show-candidate` | C1/32/250 的 ID/name 读取。 | [queries](../queries/coverage.md) |
| `stage` | all/index/domain 各实际写入与选中/未选后验，K 扩大及 P=2003 的保护审计；P=503/1003/2003 的 timing 仅 DR index no-op。 | [writes](../writes/coverage.md) |
| `sync-index` | full/selected，预检/实写/current no-op。 | [writes](../writes/coverage.md) |
| `trace` | 拆分及复杂事件、深度和预算 frontier、普通宽分支；DR 重划。 | [graphs](../graphs/coverage.md) |

## IR：14 个业务入口

| 入口 | 已核验代表 | 切面说明 |
| --- | --- | --- |
| `candidates` | 空候选及 C1/32/250 列举。 | [queries](../queries/coverage.md) |
| `check` | 全量及 selected check。 | [writes](../writes/coverage.md) |
| `discard` | 候选及正式删除；IR 候选资源显式删除。 | [writes](../writes/coverage.md) |
| `list` | 页面/空页、tag/RFC3339、关系筛选。 | [queries](../queries/coverage.md) |
| `new` | 真实候选创建。 | [writes](../writes/coverage.md) |
| `publish` | 预检零写与实际发布。 | [writes](../writes/coverage.md) |
| `rename` | 正式预检/实写/历史门禁、候选更名、真正 no-op；IR 候选资源移动。 | [writes](../writes/coverage.md) |
| `search` | metadata 命中/未命中、多匹配模式；content 命中/未命中，IR 高规模预算拒绝。 | [queries](../queries/coverage.md) |
| `set-relations` | no-op、预检、正式实写。 | [writes](../writes/coverage.md) |
| `show` | ID/name 及不存在错误。 | [queries](../queries/coverage.md) |
| `show-candidate` | C1/32/250 的 ID/name 读取。 | [queries](../queries/coverage.md) |
| `stage` | all/index/domain 各实际写入与选中/未选后验，K 扩大及 P=2003 的保护审计；IR 含 owner；三档 P timing 未在 IR 测。 | [writes](../writes/coverage.md) |
| `sync-index` | full/selected，预检/实写/current no-op。 | [writes](../writes/coverage.md) |
| `trace` | 拆分及复杂事件、深度和预算 frontier、普通宽分支；IR 资源 owner 图。 | [graphs](../graphs/coverage.md) |

## 入口之外的边界

- 两域顶层与命令帮助、版本均已读取；文本轻路径不替代业务命令。
- 两域 `search` 均区分 metadata/content；IR N=5000 content 样例是预算拒绝，成功扫描覆盖至 N=1200。
- DR `check` 仅 full；IR `check --id` 为 selected。两域 `sync-index` 的 full/selected 均有预检、无变化及实际更新代表。
- 预检按具体入口使用：`new`、`discard`、`stage`、DR `archive` 和 `mark-aligned` 没有通用 `--preflight`；DR `new --preflight-alignment` 仍创建候选。
- 关系筛选的额外 `list` 证据在图切面；它只独立核对该样例的总数，未核对全部 `filterRelations` 字段。IR 的 owner 图探针也属于图切面。
- 图与资源异常、复杂批量变更、Git 异常状态、失败注入及竞争等按各行限制保留为未测；共享源码路径只作静态依据。
