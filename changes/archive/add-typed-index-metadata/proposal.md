# Proposal

本 change 计划把通用状态索引扩展为类型化的集合级元数据协议；本文是实施前计划，不表示相关契约已经改变。

## Why

当前通用索引只保存条目、查询键和 revision，无法向读取方提供理解整个索引所需的集合级信息。后续决策查询需要同时获得领域 ID 与定义；若由决策工具自行寻找并解析另一份源文件，就会重复通用索引已有的读取、新鲜度、校验和序列化责任。现有 `StateIndexDefinition` 的解析、身份和 key 策略也只接收单条 state，无法以一致类型使用已经校验的集合元数据。

## Outcome

- 通用索引升级为 schema v2，并要求顶层包含 `metadata: JsonObject`；没有集合级数据的领域显式使用空对象。
- `StateIndex`、`StateSnapshot`、`StateIndexDefinition`、reader、runtime 和查询结果以 `State`、`Metadata` 两个泛型传播类型。
- 单条 state 的解析、身份和 key 策略接收只读、已校验的 metadata；需要完整索引的校验只在索引构造完成后运行。
- reader 和查询结果直接提供类型化 metadata，领域命令无需重新寻找集合定义源。
- `decision-records`、`investigation-report` 和 `test-evidence` 全部迁移到同一 schema v2 契约，生成产物、声明、fixture 和持久索引保持一致。

## Scope

纳入范围：

- `tools/index-runtime/` 的 schema、类型、构建、解析、规范化、查询、reader、同步和验证契约。
- 三个现有消费者的 definition、类型、索引 schema、持久索引或 fixture、生成产物和相关测试。
- Index Runtime 的稳定说明与“通用索引不保存领域元数据”这一既有长期决策的修订。
- 所有受影响 skill 的分发版本协调。

不纳入范围：

- 通用层解释、查询、局部更新或合并 metadata 的领域语义。
- 跨条目 key 派生，或向单条投影策略传入尚未构造完成的索引。
- 读取 schema v1 或为缺失 metadata 补默认值；本 change 只实现 schema v2。
- 决策领域目录、路径迁移和 CLI 展示规则；这些由后续独立 change 承接。

## Success Criteria

- schema v2 对所有索引强制要求 `metadata`；schema v1 输入以结构诊断失败。
- `StateSnapshot<State, Metadata>` 从同一源快照返回 metadata、states 和 revision；metadata 的投影变化必须由领域 revision 覆盖。
- `parseState`、`identify` 和 key `derive` 只接收已校验 metadata，不接收部分索引；`validateIndex` 只在完整规范化索引上执行。
- `StateIndexReader<State, Metadata>` 和查询结果提供只读、类型化 metadata。
- 三个消费者均通过类型检查、领域测试、生成漂移检查和持久索引检查，且只读取 schema v2。
- `investigation-report` 与 `test-evidence-review` 的分发版本从当前基线各提升一次；`decision-records` 与本组后续 change 共用相对基线的一次最终版本提升。

## Affected Owners

- `tools/index-runtime/README.md`：通用派生索引协议。
- `tools/index-runtime/src/`：共享 schema、类型、投影、读取和同步实现。
- `docs/decisions/index-runtime/`：跨 change 持续有效的索引边界与理由。
- `tools/decision-records/`、`tools/investigation-report/`、`tools/test-evidence/`：三个领域接入。
- `scripts/build/` 与对应 `skills/*/scripts/`、schema 引用：生成和分发边界。
- `docs/tooling.md` 与 `docs/coding-style.md`：源码归属、边界解析、类型和验证规则。
