---
status: active
alignment: aligned
createdAt: 2026-07-23T08:04:36Z
---

# 测试账本以领域适配接入通用状态索引

## 索引摘要
- 目的: 让测试账本直接获得通用索引的统一同步、筛选、分页和按 ID 展开能力。
- 背景: 账本登记本身已有成本；如果每次维护和查询还依赖加载完整正文或专用查询逻辑，账本增长会继续放大用户与 agent 的上下文、定位和写入成本。
- 决策: 测试领域只提供以 case ID 为身份的紧凑 state、revision、keys 和动态状态，通用层统一拥有索引外壳、新鲜度、同步以及 `query|get|all`。

## 目的
- 让 `list` 和结构化查询通过通用索引恢复有界摘要页，避免把完整账本或全量 case 状态带入 agent 上下文。
- 让 `show` 先按稳定 ID 定位，再只返回一个 case 的权威 Markdown，保持语义细节按需展开。
- 保持 Markdown 目录是测试证据事实源，索引仍是可以确定性重建、严格校验且不拥有独立事实的派生副本。
- 让测试账本只维护领域投影与结果表达，不复制通用索引的文件协议、查询、分页或同步实现。
- 让入口采集保持手动触发的自动化入口；索引查询不因入口清单或 Git 状态而默认扩大工作集。

## 背景
- 测试证据目录已经用唯一 case ID 表达长期验证义务；同一 ID 重复出现是源数据冲突，不是需要用行号消歧的合法多实例。
- 测试账本会随验证义务增长并频繁维护。即使机器能够快速解析单个 Markdown，让用户或 agent 为查找和写入反复加载全量正文仍会产生上下文、定位和冲突成本。
- 自动入口采集仍由调用方手动触发，而且只产生用于严格对账的标准清单；它是否存在不改变索引对手工登记账本的定位、筛选、分页和定点展开价值。
- 入口清单中的源码映射和 Git 变化产生的 review trigger 都依赖显式采集或当前工作区状态，把它们写进持久索引会让目录 revision 之外的事实静默陈旧。
- 决策记录已经采用“索引摘要定位、`show` 展开单份原文”的模式；测试账本虽仍可使用单个 Markdown，也需要等价的有界读取路径。
- 在约 100 个 case 的现实账本上，只有状态和验证方式筛选仍需要浏览多个摘要页；按行为、标识和路径搜索既有证据是索引最常见的查询义务。默认返回 50 条时，人类输出仍可接近两百行，不能充分兑现低上下文入口。
- 正常 review trigger 本身是查询匹配结果，不是查询失败或不完整；同时放进 case、顶层集合和 diagnostic 会重复同一事实并误导调用方。
- 通用索引运行时已经约定由领域提供 state、稳定 id、source revision 和查询键，通用层负责索引外壳、新鲜度、同步和统一 reader；测试账本无需再维护一套相似但独立的索引行为。

## 决策
- 采用: 以原始 case ID 作为索引条目的稳定 `id`；目录出现重复 ID 时阻断构建和同步，不通过行号后缀制造多个身份。
- 采用: 测试领域适配只负责从合法 Markdown 产生 state、id、revision 和 keys，按需产生 Git runtime state，并把通用诊断和结果映射为账本接口；通用层统一构造索引 Schema、校验新鲜度、同步文件并提供不可变 `query|get|all` reader。
- 采用: 持久 state 只保存标题、状态、验证方式、由现有 Contract 或 Reason 确定性产生的单行摘要、源范围，以及查询 review trigger 所需的 Code、Scope 和最近基线；完整 Contract、Proves、Risk、Reason、Review 和图示只留在 Markdown。
- 采用: `list` 和公共 query 不接收入口清单，通过通用 reader query 支持按 case ID、标题、摘要、Code 或 Scope 的组合文本检索，以及状态、验证方式和动态 trigger 精确筛选；默认最多返回 20 条带 `total`、`limit` 和 `offset` 的紧凑 state。`show` 通过通用 reader get 按保留 `id` 定位，再按索引源范围只返回目标 case 的原始 Markdown；测试领域不使用隐藏筛选模拟 get，也不重复实现全量分页。
- 采用: 入口采集器只在调用方手动触发后自动产生标准清单；入口 marker、未登记入口和映射诊断由严格 `check` 与 inspection 承接，不进入索引查询 state。
- 采用: review trigger 在持久 state 中保持为 `null`；只有显式 `list --triggered` 或等价公共查询才读取 Git 状态，并按同一 case ID 叠加 runtime state。正常 trigger 只由匹配 case 的 `trigger` 字段承接，不复制为顶层集合或查询 diagnostic，也不令 `incomplete` 为 true。
- 采用: 持久查询键包含当前有真实消费者的 `search`、`status`、`verification` 和可由运行时状态产生的 `review-triggered`；`search` 只确定性拼接已经进入紧凑 state 的 case ID、标题、摘要、Code 与 Scope。按 case 精确查询使用通用保留 `id`，不增加 `case-id` 或 `line` 键。查询键变化将领域 `definitionVersion` 提升为 2。
- 采用: source revision 只覆盖规范化目录文本、目录路径和 case ID 模式；入口清单、Git 状态及其他不改变持久 state 的配置不进入 revision。
- 采用: 通过显式 `sync-index` 检查或写入派生索引；严格 `check` 校验索引新鲜度，`list`、`show` 和公共查询在索引缺失或陈旧时失败并要求同步，不回退为完整目录扫描，也不在只读查询中自动写入。
- 采用: 测试证据分发单元继续内联通用索引共享源码，保持单 skill 可独立安装；领域 state Schema、诊断和 CLI 承接测试证据语义，通用层不接管目录写入、入口采集或 Git 触发规则。
- 不采用: 把完整 case 正文、入口映射、动态 trigger、`${caseId}@${line}` 身份或没有实际消费者的查询键复制进持久索引，因为它们会扩大查询上下文、静默陈旧或掩盖源数据冲突。
