# Design

本设计让配置完成的 state index runtime 接收一组条目 id，并把这些条目在工作区索引中的变化独立写入目标索引的 `pending` 内容。

## Context

本设计使用四种状态：

| 状态 | 本设计中的含义 |
| --- | --- |
| revision 索引 | 当前已提交版本中的完整索引，是选择操作的基线。 |
| 工作区索引 | 磁盘上的完整索引，包含所有本地索引变化，是选中条目的候选来源。 |
| 目标索引 | 选中条目采用工作区状态、未选中条目保持 revision 状态后得到的完整索引。 |
| `pending` | 准备进入下一版本的文件快照；底层怎样实现由 version-control owner 决定。 |

稳定 owner 已确认：

- [`index-runtime`](../../tools/index-runtime/README.md)拥有索引 definition、稳定 id、metadata、条目投影、完整校验、revision 和确定性序列化。
- [version-control](../../tools/shared/version-control.md)拥有 revision 与 `pending` 文件读取、跨进程写入边界、冲突检查和失败恢复。
- 接入方拥有领域文件。索引运行时不能从条目 id 推断这些文件，也不负责把它们加入 `pending`。

本 change 以 [`use-id-keyed-state-index`](../use-id-keyed-state-index/) 为前置：schema v3 的 `entries` 和 `sourceRevision.entries` 使用相同的稳定 id 键，`sourceRevision.metadata` 单独表达集合级来源。选择结果可以直接组合选中条目的 state 与来源指纹，不需要重新解析领域源，也不改变普通查询的快速新鲜度路径。

## Goals / Non-Goals

目标：

- 调用方只传选中 id，索引运行时自行读取基线与候选、解释变化并构造目标索引。
- 未选中的工作区变化不进入 `pending`，选中的新增、修改、删除和显式重命名使用同一规则。
- 目标始终是完整、可解析、可校验且 revision 自洽的索引文件。
- 同一索引已有待提交变化时，在受锁写入边界内直接拒绝。
- 只修改目标索引的 `pending` 内容，不修改工作区索引、领域文件或其他待提交路径。

非目标：

- 不接收或操作领域文件，也不证明领域文件已经暂存。
- 不接收调用方构造的基线条目、变化对象、metadata、revision 或目标文件集合。
- 不合并同一索引的既有待提交变化。
- 不按条目选择 metadata、迁移 definition 或编辑任意 JSON 片段。
- 不提供跨索引、索引与领域文件之间的原子事务。

## Decisions

1. **公共操作按条目命名并只接收 id。** 独立函数命名为 `stageSelectedIndexEntries`，配置完成的 `StateIndexRuntime` 提供 `stageSelectedEntries`。`selectedIds` 必须非空、合法且不重复；业务结果不依赖输入顺序。

   ```ts
   export async function stageSelectedIndexEntries<
     State extends object,
     Metadata extends JsonObject
   >(options: Readonly<{
     context: StateIndexContext;
     definition: StateIndexDefinition<State, Metadata>;
     indexPath: string;
     selectedIds: readonly string[];
   }>): Promise<StateIndexEntryStageResult>;
   ```

   公共输入不包含领域路径、领域源、完整基线、变化类型、目标 metadata、目标 revision、领域文件或 version-control 文件计划。

2. **revision 索引是基线，工作区索引是候选。** 操作从 `context.root` 定位版本仓库并读取 current revision 中的目标 index path；revision 没有该文件表示空基线。操作再从工作区读取同一路径并使用同一 definition 完整解析。其他读取失败、definition 不匹配或索引无效都直接失败，不把领域源作为回退。

3. **id 的存在状态决定条目变化。** 两份索引的 `entries` 与 `sourceRevision.entries` 已经按相同 id 键控，操作按下表直接构造目标条目与逐条来源指纹：

   | revision 中存在 | 工作区中存在 | 是否选中 | 目标结果 |
   | --- | --- | --- | --- |
   | 是 | 是 | 是 | 使用工作区条目。 |
   | 否 | 是 | 是 | 加入工作区条目。 |
   | 是 | 否 | 是 | 删除 revision 条目。 |
   | 是 | 任意 | 否 | 保留 revision 条目。 |
   | 否 | 是 | 否 | 不加入目标。 |
   | 否 | 否 | 是 | 输入无效并失败。 |

   重命名不自动推断；调用方同时选择旧 id 和新 id。目标可以为空，最终是否合法仍由 definition 的完整校验决定。

4. **条目选择不包含集合级变化。** revision 索引存在时，工作区 metadata 与 `sourceRevision.metadata` 必须分别和 revision 索引相同；不同则以稳定诊断拒绝，并要求调用方改用普通文件级暂存完整索引。首次建立索引时使用工作区完整 metadata 与 metadata 来源指纹。schema、namespace、definitionVersion 和 key definition 不一致也不进入条目级操作。

5. **目标索引从 state 重新构造。** 操作只从两份索引提取目标 state 和对应的 `sourceRevision.entries[id]`，不复制工作区的 keys、对象键顺序或其他派生字段。所有目标 state 使用同一 definition 重新执行解析、key 投影、规范化和完整 `validateIndex`，再按稳定 id 顺序序列化。

6. **目标 `sourceRevision` 与条目使用同一选择。** metadata 来源指纹沿用第 4 条确定的集合级值；选中且工作区存在的 id 使用工作区逐条指纹，选中删除移除该 id，未选中 id 保留 revision 指纹。目标 `sourceRevision.entries` 与目标 entries 必须拥有完全相同的 id 集合。

   逐条指纹只作为索引已有数据参与组合；本操作不调用领域 `read` / `readRevision`，不扫描或解析领域文件。结构化 revision 的生成、快速读取和 schema v3 迁移由前置 change 完整负责。

7. **同一索引已有待提交变化时直接拒绝。** index-runtime 把 current revision、目标 index path 在 revision 中的期望内容以及目标索引文本交给 version-control。version-control 在既有写入锁内重新读取目标路径的 `pending` 内容；它必须与 revision 逐字节相同，首次索引时两者都必须不存在。任何差异都以冲突失败，不写入目标。

   `replacePendingFiles` 增加可选的期望 `pending` 文件集合。期望比较、current revision 检查、目标替换、读回和失败恢复全部位于同一受锁边界；目标路径之外的 `pending` 内容保持不变。

8. **成功只表示索引条目已暂存。** 成功结果报告目标 index path、namespace、排序后的 selectedIds、是否产生差异和最终状态。操作不写工作区、不调用 commit，也不读取或写入任何领域文件。调用方若要暂存领域文件，必须通过自己的领域能力另行完成并自行验证最终提交范围。

9. **失败不留下部分索引写入。** 路径或 id 无效、输入索引不可用、metadata/definition 改变、目标校验失败、同索引 `pending` 不干净、current revision 改变以及写入或恢复失败都返回稳定状态和 `StateIndexDiagnostic`。index-runtime 不回退到底层 Git 操作，也不向调用方暴露 Git 专属信息。

## Risks / Trade-offs

- 本 change 依赖 schema v3 的 id 键控 entries 与结构化来源 revision；前置 change 尚未对齐时不能开始实现选择性暂存。
- 工作区索引中的逐条来源指纹必须与其 state 同源；本操作只验证索引内部结构，不读取领域源证明工作区索引已经同步，接入方仍需维护自己的领域文件与完整索引。
- metadata 或 definition 变化不能和少数条目一起暂存；这避免把影响整个集合的变化错误归入选中 id。
- 选中条目的局部组合可能违反跨条目约束；完整校验会拒绝结果，调用方需要补选共同形成合法集合的条目。
- 索引与领域文件是独立暂存操作，不承诺跨 owner 原子性；接入方必须检查自己的最终提交范围。
- 同一索引已有待提交变化时拒绝会让该索引的暂存阶段串行执行，但能避免不同任务混入同一提交或互相覆盖。
- 每次操作都读取并重建完整索引，成本随索引规模增长；本 change 不建立增量计算或持续性能 SLO。

## Open Questions

无。
