# Design

本 design 在不改变既有 trace 选择或 JSON 契约的前提下，恢复由同一查询结果派生的文本与 JSON 双 renderer。

## Context

- `a7c85f8e` 已实现稳定 trace selection、事件原子接纳、coverage、frontier、blockedEvent 与领域 entry projection；当前 CLI 无条件序列化其 JSON success envelope。
- 已归档的 `redesign-trace-for-agent-consumption` Change 的 `trace-output-examples.md` 留存直接确认的终端图：`TRACE` header、`L0/L1`、`* trace`、`~ context` 和拆分事件上下文。它明确不是 Mermaid，也不是旧的平铺文本。
- 历史讨论确认 `--json` 返回同一 raw projection；随后 JSON 投影调整不曾取消文本 renderer。上一 Change 将“不保留旧平铺文本兼容层”误扩展为 JSON-only，形成当前缺口。
- 两个领域的 trace 结果类型和选择语义已有 owner；本 Change 不改变默认 `direction=both`、`depth=5`、`maxRecords=50`，也不改变失败、诊断、退出状态或 JSON 字段。

## Goals / Non-Goals

目标：

- 让两个 CLI 的 trace 默认输出可读、确定性的终端关系图。
- 用 `--json` 明确选择当前稳定 JSON envelope。
- 让两个 renderer 都只消费同一次领域 trace 成功结果，不复制遍历、预算或事件闭合。
- 在文本图中显式呈现成员、事件、关系摘要与 coverage 边界。

非目标：

- 不恢复改动前的平铺文本输出，不引入 Mermaid、JSON Schema、图形 UI 或跨领域统一 renderer。
- 不修订查询默认值、trace API、关系事件定义、JSON shape 或失败路径。

## Decisions

### Intended Change

1. 两个 trace CLI 新增单值布尔 `--json`。无该 flag 时走终端文本图 renderer；有该 flag 时对同一份 trace 查询成功结果进行原样稳定 JSON 序列化。终端图不是旧的平铺文本，也不是 Mermaid。
2. 领域各自拥有文本 renderer，因为 entry 生命周期字段和关系类型不同；共同约束只通过现有 trace success shape 传递，不为两段短输出建立新的共享抽象。
3. 文本 renderer 从 `traceIds`、`contextIds`、`entries`、`direction`、`limits`、`coverage`、`frontier` 和可选 `blockedEvent` 派生输出。它不读索引、不调用选择逻辑、不重新排序或重新判断事件接纳。
4. header 固定表达 anchor、direction、depth、complete 与记录总数。图层按请求方向的内部 trace relations 以稳定 BFS 层形成；`both` 使用可重复的方向与 ID 顺序。每个 trace 节点只有一个完整主体块；context 只在事件上下文中标记为 `~`，不成为递归主体块。
5. 节点主体展示 `predecessors`、`successors` 或领域事件组（至少 split、merge，Decision 另含 reallocation）；事件成员显示 `* trace` 或 `~ context`，并在 relation 存在 `summary` 时显示摘要。未提供 summary 时不虚构文本。
6. 文本末尾在不完整 coverage 时稳定输出 frontier；存在 blockedEvent 时完整输出其 kind、recordIds 与 requiredMaxRecords。完整查询不输出伪边界。

### Resulting Impacts

- Decision 的 CLI option、help、成功输出、trace tests、skill 契约与生成制品需要同步。
- Investigation 的 parser、help、查询成功输出、trace tests、skill 契约与生成制品需要同步。
- 新增或修改的最小测试入口必须有 Test Evidence Case；现有 trace Cases 按意图连续性更新，索引同步。
- 两个领域的版本在行为与公共 CLI 契约变化后递增；分发源码通过现有 sync 命令生成，不能手写 bundle。

## Risks / Trade-offs

- 文本图若重做遍历会与 JSON 漂移；renderer 只接收成功结果，并以测试证明 `--json` 仍是原 envelope。
- 多事件和 `both` 图层易出现重复或不稳定；测试使用拆分、归并、重划、context、截断与 summary fixture 锁定稳定文本。
- 过度抽象两个领域的 rendering 会掩盖各自事件语义；保留领域局部纯 renderer，仅复用既有 result 类型。

## Open Questions

无。历史示例已确认文本图形式及 `--json` 分流；本 Change 只恢复遗漏契约。
