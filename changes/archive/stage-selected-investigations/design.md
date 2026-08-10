# Design

本设计只描述 investigation-report 怎样把选中的主题 id 交给 `index-runtime`，并暂存对应索引条目。

## Context

已归档的前置 change [`stage-selected-index-entries`](../stage-selected-index-entries/design.md)记录了通用能力的实现；当前行为契约由 [`Index Runtime`](../../../tools/index-runtime/README.md) 承接。配置好的 `StateIndexRuntime` 只需接收 `selectedIds`，即可从 revision 索引与工作区索引构造并暂存完整目标索引。它不接收或操作领域文件。

调查 Markdown 是权威内容，`investigation-index.json` 是完整派生索引。现有 definition 直接使用调查根相对主题路径作为稳定索引 id，因此领域接入不需要增加另一层路径到 id 的映射。主题文件本身可用普通路径暂存，不需要进入索引 API。

随附资源模型已经把资源 ID 与 SHA-256 放入索引 metadata，并让 `sourceRevision.metadata` 覆盖资源集合与内容。它们属于完整调查集合，不属于某个主题条目。公共按 ID 暂存契约在既有基线下要求这两项集合级值不变，因此领域接入必须保留该门禁，而不是从主题引用关系反推资源选择。

## Goals / Non-Goals

目标：

- 提供符合调查领域习惯的主题 id 输入，并直接复用现有 index id。
- 复用配置完成的 index runtime 完成索引条目暂存。
- 明确索引暂存结果不代表调查 Markdown 已经暂存。
- 保持随附资源的集合级 metadata 边界，资源变化时明确退回完整索引的普通文件级暂存。

非目标：

- 不读取 revision 主题集合来构造索引基线或目标 `sourceRevision`。
- 不向 index-runtime 提供 state 变化、metadata、领域文件或待提交文件计划。
- 不暂存调查 Markdown，也不建立索引与 Markdown 的跨文件事务。
- 不选择或暂存随附资源文件，不按主题拆分资源 metadata 或资源来源指纹。
- 不修改公共索引契约或让既有查询命令感知 `pending`。

## Decisions

1. 调查入口命名为 `stage-index <topic-id...>`，至少接收一个不重复的 `<category>/<slug>.md` POSIX id。命令名明确只暂存索引，不暗示主题 Markdown 已经暂存。
2. topic id 直接使用现有 definition 的 state id。重命名时调用方同时选择旧 id 和新 id；investigation-report 不维护第二套选择身份或变化类型。
3. 配置完成的 `StateIndexRuntime` 接收校验后的 `selectedIds` 并执行 `stageSelectedEntries`。调查领域不读取 revision 索引、不合并 entry、不计算目标 revision，也不操作 JSON hunk。
4. 随附资源 ID、哈希和 `sourceRevision.metadata` 继续作为集合级契约。既有基线下任一值变化时，`stageSelectedEntries` 在写入前拒绝；调查命令保留该诊断并提示调用方普通文件级暂存完整索引，不尝试把资源变化归入选中主题。
5. 同一 investigation index 已有待提交变化时，索引运行时直接拒绝；调查命令不清除、替换或合并这份既有内容。
6. 成功结果只证明所选调查 id 的索引变化已经进入 `pending`。命令不读取或暂存调查 Markdown 与随附资源；用户需要提交领域内容时另行按路径选择。
7. 参数错误退出 `2`；索引、环境、冲突或写入失败退出 `1`，并保留 index-runtime 的稳定诊断分类。

## Risks / Trade-offs

- 调查 Markdown 与索引条目需要分别暂存，调用方必须在提交前核对两者；本 change 不提供跨 owner 原子性。
- 同一索引已有待提交变化时拒绝会使索引暂存阶段串行，但不会限制工作区中并行编辑多个主题。
- topic id 继续沿用现有路径身份；路径规范或重复输入必须在调用 index-runtime 前失败。
- 新增、删除或修改随附资源时不能使用条目级暂存；这是公共集合级契约的保守门禁，代价是该类提交需要普通文件级暂存完整索引。

## Open Questions

无。
