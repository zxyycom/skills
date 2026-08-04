# Design

本设计把“选择性暂存”中的索引核心定义为纯 state 物化：`index-runtime` 生成完整领域派生索引，领域与 version-control 分别负责 companion files 和 `pending` 写入。

## Context

术语固定如下：

| 术语 | 本 change 中的含义与 owner |
| --- | --- |
| 领域派生索引 | `index-runtime` 管理的完整 JSON state 投影，不是事实源。 |
| `pending` | 共享 version-control 暴露的下一版本快照；Git index 只是当前内部实现。 |
| 权威源 | Markdown、目录表或其他领域事实文件，由领域拥有。 |
| companion files | 领域决定是否与派生索引一起写入 `pending` 的权威源文件；`index-runtime` 不读取或写入。 |
| 选择变化（selected change） | 对基线 state 的显式 upsert 或 delete，不表示 JSON hunk。 |

现有查询 overlay 证明按 id 替换和追加 state 的投影可以由通用层拥有，但它保留原 metadata 与 `sourceRevision`、不支持删除且不持久化。现有 `buildStateIndex` 又把 snapshot 读取绑定在 definition 的 `read(context)` 上，导致内存目标调用方临时替换 reader。

## Goals / Non-Goals

目标：

- 让 `index-runtime` 完整拥有“基线 state + 选择变化 → 完整派生索引”。
- 让调用方显式提供通用层无法推导的目标 metadata 和 `sourceRevision`。
- 让 snapshot 直建、选择性索引物化和 filesystem 同步共享同一投影与完整校验路径。
- 用 decision-records 的既有选择性暂存证明公共入口能承接真实领域，而不削弱领域校验。
- 保持领域源、`pending` 和失败恢复 owner 不变。

非目标：

- 不让 index-runtime 构造或写入版本管理快照。
- 不从索引 state 反向生成权威源；state 可能只包含源文件的部分投影。
- 不把查询态 runtime overlay 变成隐式持久写入。

## Decisions

1. **snapshot 直建**：从现有 builder 提取公共 `buildStateIndexFromSnapshot(definition, snapshot, options?)`。它验证 definition、snapshot 外形、metadata、state、id/key、完整索引与领域 `validateIndex`，并返回规范化 `StateIndex`。现有 `buildStateIndex(definition, context)` 只负责调用 `definition.read`，然后复用该入口。
2. **选择性物化输入**：新增公共入口接收 definition、可为空的完整基线 snapshot、目标 metadata、目标 `sourceRevision` 和与顺序无关的选择变化集合。每项变化只能是完整 state 的 `upsert`、带 `replaceId` 的 `upsert`，或基线 id 的 `delete`；入口不接收路径、文件或 `pending`。
3. **目标 state 集合算法**：通用层按以下固定顺序形成目标集合：
   1. 在基线 metadata 下恢复并验证每个基线 state 的唯一 id。
   2. 按基线 id 应用 `delete` 和 `replaceId`，任何缺失、重复消费或互相冲突都失败。
   3. 在目标 metadata 下计算未提供 `replaceId` 的 upsert id；如果该 id 与一个尚未消费的基线 id 字符串相同，则移除该基线 state。多个变化争用同一基线 id 时失败。
   4. 用剩余基线 state 与全部 upsert state 构造目标 snapshot，在目标 metadata 下重新解析和投影整个集合，再执行完整索引校验。

   未提供 `replaceId` 的 upsert 默认表示新增；只有当其目标 id 与基线 id 字符串相同时，才表示身份未变化的替换。metadata 或 state 改变导致身份变化时，调用方必须使用 `replaceId`，或显式提交 delete + upsert。重新投影后的任何目标 id 冲突都失败，不采用最后写入获胜。
4. **metadata 与重新投影**：目标 metadata 由调用方显式提供。所有保留和 upsert state 都在目标 metadata 上下文中重新解析与投影，因此 metadata 改变不会沿用旧 id 或 keys。
5. **`sourceRevision`**：目标 `sourceRevision` 是调用方提供的不透明非空文本。`index-runtime` 只验证通用外形并写入结果，不尝试从 state 或 companion files 推导；领域继续保证它覆盖自身完整权威来源。
6. **输出**：物化入口返回完整 `StateIndexResult<StateIndex>`；调用方需要文本时继续使用同一定义调用 `serializeStateIndex`。首版不返回 `pending` plan 或 companion file 列表。
7. **责任边界**：领域 stage 负责读取 version-control revision 与 filesystem、把选中源解析为 state、计算目标 metadata/`sourceRevision`，并决定 companion files。共享 version-control 负责把领域给出的最终文件集合写入 `pending`。`index-runtime` 不依赖 version-control。
8. **decision-records 强制接入**：decision-records 是本 change 的第一个真实领域消费者，不只迁移 snapshot 直建。迁移后的 stage 按以下责任链执行：
   1. decision-records 从 version-control revision 读取完整基线决策源，并用现有 source builder 得到基线 snapshot；首次集合使用空基线。
   2. decision-records 在源文件层应用选中路径，形成完整目标源集合，并继续用现有 source builder 校验决策格式、domain、引用目标和关系一致性，得到目标 metadata、`sourceRevision` 与目标 state 集合。
   3. decision-records adapter 根据选中路径在基线和目标 state 中的存在性形成 upsert/delete；显式重命名形成旧 id delete 与新 state upsert。
   4. `index-runtime` 选择性物化入口以基线 snapshot、选择变化和目标 metadata/`sourceRevision` 生成最终索引。decision-records 不再通过临时 definition reader 直接构建 stage 索引。
   5. decision-records 继续序列化并复核最终索引，然后把完整目标权威源和索引交给 version-control 写入 `pending`。

   完整目标 snapshot 在这里是决策领域校验输入，不是绕过选择性物化的索引构建路径。

## Risks / Trade-offs

- 调用方可以提供与权威源不一致的 `sourceRevision`；这是现有领域 definition 已承担的义务，公共层无法从投影 state 证明原始字节。
- metadata 改变时重新计算全部身份和 keys，成本与完整索引规模线性相关；该行为优先保证确定性与完整校验。
- 选择性索引物化不能替代领域 source overlay。一个源变化即使不改变 state 投影，也仍可能改变 `sourceRevision` 和 companion file 内容。
- delete 与 `replaceId` 以基线 metadata 下的 id 表达；identity 会随 metadata 改变的领域必须在 adapter 中明确旧身份，不能依赖位置或调用顺序猜测。
- decision-records 为保留跨记录关系校验，迁移时仍需构造完整目标 source snapshot；这会保留一次领域级完整解析，但最终索引集合控制和投影只由 `index-runtime` 完成。

## Open Questions

无。
