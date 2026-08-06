# Design

本设计只描述 test-evidence 怎样把选中的 case id 交给 `index-runtime`，并暂存对应索引条目。

## Context

前置 change [`stage-selected-index-entries`](../stage-selected-index-entries/design.md)完成后，配置好的 `StateIndexRuntime` 只需接收 `selectedIds`，即可从 revision 索引与工作区索引构造并暂存完整目标索引。它不接收或操作领域文件。

topic 表和 case Markdown 是权威内容，`test-evidence-index.json` 是完整派生索引。现有 definition 直接使用 case id 作为稳定索引 id，因此领域接入不需要增加另一层路径到 id 的映射。topic 表、case 文件和代码都能独立选择，不需要进入索引 API。

## Goals / Non-Goals

目标：

- 提供符合测试证据领域习惯的 case id 输入，并直接复用现有 index id。
- 复用配置完成的 index runtime 完成索引条目暂存。
- 明确索引暂存结果不代表 topic 表、case Markdown 或代码已经暂存。

非目标：

- 不读取 revision 证据集合来构造索引基线、目标 metadata 或 `sourceRevision`。
- 不向 index-runtime 提供 state 变化、领域文件或待提交文件计划。
- 不暂存 topic 表、case Markdown 或代码，也不建立跨文件事务。
- 不修改公共索引契约或让既有查询命令感知 `pending`。

## Decisions

1. 测试证据入口命名为 `stage-index <case-id...>`，至少接收一个不重复的稳定 case id。命令名明确只暂存索引，不暗示 topic 表、case Markdown 或代码已经暂存。
2. case id 直接使用现有 definition 的 state id。重命名时调用方同时选择旧 id 和新 id；test-evidence 不维护第二套选择身份、变化类型或 topic 归属判断。
3. 配置完成的 `StateIndexRuntime` 接收校验后的 `selectedIds` 并执行 `stageSelectedEntries`。测试证据领域不读取 revision 索引、不合并 entry、不选择 metadata、不计算目标 revision，也不操作 JSON hunk。
4. 同一 test-evidence index 已有待提交变化时，索引运行时直接拒绝；测试证据命令不清除、替换或合并这份既有内容。
5. 成功结果只证明所选 case id 的索引变化已经进入 `pending`。命令不读取或暂存 topic 表、case Markdown 或代码；用户需要提交这些内容时另行按路径选择。
6. 参数错误退出 `2`；索引、环境、冲突或写入失败退出 `1`，文本与 `--json` 结果保留 index-runtime 的稳定诊断分类。

## Risks / Trade-offs

- topic 表、case Markdown、代码与索引条目需要分别暂存，调用方必须在提交前核对范围；本 change 不提供跨 owner 原子性。
- 同一索引已有待提交变化时拒绝会使索引暂存阶段串行，但不会限制工作区中并行编辑多个 case。
- case id 继续沿用现有证据身份；格式或重复输入必须在调用 index-runtime 前失败，目标集合的 topic 归属继续由现有 definition 完整校验。

## Open Questions

无。
