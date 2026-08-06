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

一个选择结果会混合 revision 条目与工作区条目。现有 `sourceRevision` 由领域根据完整源集合计算，索引运行时无法只凭两份索引为混合结果还原该领域 revision。因此，索引 revision 必须由最终规范化索引内容统一派生，而不能作为选择操作的额外输入。

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

3. **id 的存在状态决定条目变化。** 两份索引分别按 id 建立唯一映射，再按下表构造目标条目：

   | revision 中存在 | 工作区中存在 | 是否选中 | 目标结果 |
   | --- | --- | --- | --- |
   | 是 | 是 | 是 | 使用工作区条目。 |
   | 否 | 是 | 是 | 加入工作区条目。 |
   | 是 | 否 | 是 | 删除 revision 条目。 |
   | 是 | 任意 | 否 | 保留 revision 条目。 |
   | 否 | 是 | 否 | 不加入目标。 |
   | 否 | 否 | 是 | 输入无效并失败。 |

   重命名不自动推断；调用方同时选择旧 id 和新 id。目标可以为空，最终是否合法仍由 definition 的完整校验决定。

4. **条目选择不包含集合级变化。** revision 索引存在时，工作区 metadata 必须与 revision metadata 规范化后相同；不同则以稳定诊断拒绝，并要求调用方改用普通文件级暂存完整索引。首次建立索引时使用工作区 metadata。schema、namespace、definitionVersion 和 key definition 不一致也不进入条目级操作。

5. **目标索引从 state 重新构造。** 操作只从两份索引提取目标 state，不复制工作区的 keys、条目顺序或其他派生字段。所有目标 state 使用同一 definition 重新执行解析、id/key 投影、规范化和完整 `validateIndex`，再按稳定 id 顺序序列化。

6. **索引 revision 由最终投影统一派生。** 字段名继续使用 `sourceRevision`，值使用 `sha256:<hex>`；摘要输入是排除 `sourceRevision` 字段后的完整规范化索引投影，并包含算法版本、schemaVersion、namespace、definitionVersion、keyDefinitions、metadata 和全部 `id/state/keys`。本 change 不因 revision 语义收口而另行升级索引 schema。

   完整构建、解析自检和条目暂存复用同一算法。`StateSnapshot.revision` 与 `StateIndexDefinition.readRevision` 继续存在，但必须返回同一 projection revision，不能由领域使用另一种源摘要；既有“低成本 `readRevision`”承诺相应取消。现有消费者需要迁移，但不改变其领域 state、文件格式或领域文件暂存责任。

7. **同一索引已有待提交变化时直接拒绝。** index-runtime 把 current revision、目标 index path 在 revision 中的期望内容以及目标索引文本交给 version-control。version-control 在既有写入锁内重新读取目标路径的 `pending` 内容；它必须与 revision 逐字节相同，首次索引时两者都必须不存在。任何差异都以冲突失败，不写入目标。

   `replacePendingFiles` 增加可选的期望 `pending` 文件集合。期望比较、current revision 检查、目标替换、读回和失败恢复全部位于同一受锁边界；目标路径之外的 `pending` 内容保持不变。

8. **成功只表示索引条目已暂存。** 成功结果报告目标 index path、namespace、排序后的 selectedIds、是否产生差异和最终状态。操作不写工作区、不调用 commit，也不读取或写入任何领域文件。调用方若要暂存领域文件，必须通过自己的领域能力另行完成并自行验证最终提交范围。

9. **失败不留下部分索引写入。** 路径或 id 无效、输入索引不可用、metadata/definition 改变、目标校验失败、同索引 `pending` 不干净、current revision 改变以及写入或恢复失败都返回稳定状态和 `StateIndexDiagnostic`。index-runtime 不回退到底层 Git 操作，也不向调用方暴露 Git 专属信息。

## Risks / Trade-offs

- 统一 projection revision 会改变现有索引的 `sourceRevision`，并要求现有消费者同步迁移；这是让混合后的完整索引只凭自身内容保持自洽的代价。
- `readRevision` 不再承诺低成本；依赖 revision 新鲜度的读取和同步可能需要完成领域 state 投影，实施时必须回归现有规模场景。
- metadata 或 definition 变化不能和少数条目一起暂存；这避免把影响整个集合的变化错误归入选中 id。
- 选中条目的局部组合可能违反跨条目约束；完整校验会拒绝结果，调用方需要补选共同形成合法集合的条目。
- 索引与领域文件是独立暂存操作，不承诺跨 owner 原子性；接入方必须检查自己的最终提交范围。
- 同一索引已有待提交变化时拒绝会让该索引的暂存阶段串行执行，但能避免不同任务混入同一提交或互相覆盖。
- 每次操作都读取并重建完整索引，成本随索引规模增长；本 change 不建立增量计算或持续性能 SLO。

## Open Questions

无。
