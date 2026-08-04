# Proposal

本 change 计划让 `index-runtime` 把显式选择的 state 变化物化为新的完整领域派生索引，并让 decision-records 的既有选择性暂存成为第一个强制接入者；领域调用方仍自行处理权威源文件和 `pending` 写入。本 proposal 定义公共能力、首个迁移和验收边界。

## Why

本仓库同时存在两类容易混淆的 index：`index-runtime` 管理可删除重建的领域派生 JSON 索引；共享 version-control 的当前 Git 实现使用 Git index 承载 `pending`。本 change 只扩展前者，不让 `index-runtime` 操作 Git index。

`index-runtime` 已经拥有完整 snapshot 的投影、校验、规范化和序列化，也允许查询时用 `runtimeStates` 按 id 替换或追加 state。但查询 overlay 不能删除条目、改变 metadata 或 `sourceRevision`，也不会产生可持久化的完整索引。decision-records 当前在源文件层应用选择后构造完整目标 snapshot，以完成领域关系校验，再通过临时 definition reader 直接构建 stage 索引。目标 source snapshot 仍有领域价值，但最终索引集合控制不应由每个领域重复实现。

三个领域都需要的核心不是暂存 JSON 文本的部分 hunk，而是从 version-control revision 对应的基线 state 叠加选中的增加、替换和删除，得到一个新的完整索引状态。权威 Markdown、目录表等领域文件不属于 `index-runtime`；领域可以按自身契约把它们作为 companion files 加入 `pending`，也可以在不需要权威源同行的场景中只使用索引结果。

## Outcome

- `index-runtime` 提供从调用方给定 snapshot 直接构建完整索引的公共入口，不再要求临时覆盖 definition 的 `read`。
- `index-runtime` 提供选择性物化入口：以完整基线 state、目标 metadata、目标 `sourceRevision` 和显式 upsert/delete 变化生成新的完整索引。
- 选择性物化支持新增、显式替换、删除、首次空基线、合法空结果、metadata 变化、完整后置校验和确定性序列化。
- 公共能力只返回领域派生索引结果，不读取 filesystem、revision 或 pending，也不操作权威源文件。
- decision-records 作为第一个真实领域消费者，把现有选择性暂存迁移到选择性物化入口；其 source overlay、决策关系校验、权威源文件选择和 `pending` 写入保持由 decision-records 拥有。
- [`stage-selected-investigations`](../stage-selected-investigations/) 与 [`stage-selected-test-evidence`](../stage-selected-test-evidence/) 在本 change 完成后直接消费选择性物化入口，不再各自实现索引 overlay。

## Scope

纳入范围：

- snapshot 直建与选择性索引物化的公共类型、函数、诊断和确定性结果。
- 基线 state 与显式 `upsert(state, replaceId?)`、`delete(id)` 的目标集合语义；identity 改变时调用方明确指出被替换的基线 id。
- 调用方显式提供目标 metadata 与 `sourceRevision`；通用层不解释或推导它们的领域来源。
- 完整 index validation、field order、id/key 投影、重复变化与非法删除诊断。
- decision-records 选择性暂存 adapter 的强制迁移和回归，index-runtime README、长期决策、测试与测试证据。

不纳入范围：

- revision、filesystem、pending 或 Git index 的读取与写入。
- 权威 Markdown、目录表、topic 表或其他 companion files 的选择、解析与暂存。
- 改变现有查询 overlay、持久索引同步、查询语言或领域 source revision 算法。
- 建立通用 CLI、领域注册表、provider 或版本管理后端框架。

## Success Criteria

- 调用方可以用 definition 与完整 `StateSnapshot` 直接得到和现有 `buildStateIndex` 相同的规范化索引结果。
- 选择性物化以基线 state 叠加显式 upsert/delete，并使用调用方给定的目标 metadata 与 `sourceRevision` 生成完整索引；输入顺序不改变输出。
- 新增、按基线 id 替换、删除、首次空基线、合法空结果、重复变化、缺失删除/替换、目标 id 冲突、metadata 变化和完整 `validateIndex` 均有明确结果或稳定诊断。
- 公共 API 不接收仓库、路径范围、pending 或领域文件类型；它不导入共享 version-control。
- decision-records 保留源文件 overlay，但删除临时 definition reader 覆盖及其直接构建 stage 索引的路径；其 stage 必须把基线 snapshot、选择变化和目标 metadata/`sourceRevision` 交给公共选择性物化入口生成最终索引。
- decision-records 迁移后继续用完整目标源集合执行决策格式、domain 和关系一致性校验；源文件选择、失败语义与 `pending` 结果保持不变。
- decision-records 最终索引的 entries、metadata 与 `sourceRevision` 必须和经过领域校验的完整目标 snapshot 一致；未选择的 filesystem 决策变化不得进入 `pending`。
- index-runtime、decision-records 目标测试、确定性与规模证据、测试证据、类型检查、生成漂移和 `bun run check` 通过。

## Affected Owners

- [`tools/index-runtime/README.md`](../../tools/index-runtime/README.md)、`tools/index-runtime/src/` 与 `tools/index-runtime/tests/`：公共索引状态物化契约、实现和证据。
- `tools/decision-records/src/` 与测试：首个必须接入选择性物化的领域消费者；source overlay、领域校验和 `pending` 行为保持由 decision-records 拥有。
- [`tools/shared/version-control.md`](../../tools/shared/version-control.md)：用于确认 pending 写入仍由既有 owner 承接，本 change 不修改其接口。
- `docs/decisions/index-runtime/` 与统一决策索引：跨 change 持续有效的索引物化方向与责任边界。
- `docs/test-evidence/`：新增或修改测试入口的 case 与派生索引。
