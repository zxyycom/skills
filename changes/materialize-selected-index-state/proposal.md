# Proposal

本 proposal 是 `materialize-selected-index-state` 的实施前计划：为 `index-runtime` 增加纯内存的 snapshot 直建与选择性 state 物化能力，并让 decision-records 成为首个实际接入者。

## Why

本仓库同时存在两类名称相近但 owner 不同的 index：`index-runtime` 管理可由领域事实源删除重建的完整 JSON 派生索引；共享 version-control 管理下一版本的 `pending` 快照，Git index 只是它的当前内部实现。本 change 只扩展前一种索引，不让 `index-runtime` 读取或写入 `pending`。

`index-runtime` 已拥有完整 `StateSnapshot` 的投影、校验、规范化和序列化，但 `buildStateIndex` 只能通过 `definition.read(context)` 取得 snapshot。decision-records 已经能从“revision 基线 + 选中的 filesystem 路径”构造并校验完整目标源集合，当前却要通过覆盖 `definition.read` 才能从该 snapshot 构建索引。公共 snapshot 直建入口应承接这一步。

decision-records 与 investigation-report 都维护会长期增长、经常并行演进的独立内容，但各自只保存一个覆盖完整集合的派生索引。两个领域都需要从 revision 基线叠加本次明确选择的新增、替换和删除，生成不带入其他 filesystem 变化的完整索引；这是持续存在的共同能力，不是只为单次迁移准备的便利函数。decision-records 已有 stage 流程并作为本 change 的首个接入者，investigation-report 是已确认的后续接入者。

test-evidence 具有相同的完整索引结构，但代码与证据变化较少并行推进，因此只作为可选消费者，不作为本 change 成立或完成的依据。查询时的 `runtimeStates` overlay 不能删除条目、改变 `sourceRevision`、执行完整后置校验或产出新的完整索引，不能承担选择性暂存流程。

两个主要领域以及可能后续接入的 test-evidence，其公共部分止于“完整基线成员 + 显式 state 变化 + 目标 metadata/source revision → 完整派生索引”。权威 Markdown、目录表、topic 表、选择路径、source revision 计算、companion files 和 `pending` 写入仍由领域与 version-control 各自拥有。

## Outcome

- `index-runtime` 提供 `buildStateIndexFromSnapshot`，让调用方直接从完整 `StateSnapshot` 得到与现有 `buildStateIndex` 相同的规范化、完整校验结果；现有 builder 在完成 source read 后复用该入口。
- `index-runtime` 提供 `materializeStateIndex`，以完整基线成员清单、显式 `upsert`/`delete`、目标 metadata 和目标 source revision 生成新的完整 `StateIndex`。
- 基线中预计保留的成员提供完整 state；已被调用方选中且将被替换或删除的旧成员可以只提供旧 id，但该仅身份成员必须被本次变化消费，不能被静默遗漏。
- 选择性物化支持新增、同 id 替换、通过 `replaceId` 替换旧 id、删除、首次空基线、合法空结果和 metadata 变化；变化输入顺序不影响结果，冲突使用稳定诊断失败。
- 公共入口只处理内存 state 与索引投影，不读取 filesystem、version-control revision 或 `pending`，也不选择、生成或写入权威源和 companion files。
- decision-records 继续先把选中 filesystem 变化应用到 revision 原始源，再完整校验目标源；随后从目标 state、revision 成员和选择路径构造物化输入，最终 stage 索引由选择性物化入口生成。
- [`stage-selected-investigations`](../stage-selected-investigations/) 依赖该公共契约；[`stage-selected-test-evidence`](../stage-selected-test-evidence/) 可以复用同一契约。两个领域的 stage 实现都不属于本 change。

## Scope

纳入范围：

- snapshot 直建与选择性物化的公共类型、导出函数、稳定诊断和确定性结果。
- 基线 metadata、完整 state 成员、仅身份成员、目标 metadata/source revision 以及 `upsert(state, replaceId?)`、`delete(id)` 的 id 与冲突语义；`replaceId` 和 `delete.id` 都引用基线 id。
- 目标集合的重新解析、id/key 投影、field order、规范化、完整结构校验和领域 `validateIndex`。
- decision-records stage adapter 的首次实际迁移与行为回归。
- index-runtime README、必要长期决策、测试、测试证据和生成产物。

不纳入范围：

- 在 `index-runtime` 中增加 filesystem、version-control revision、`pending` 或 Git index 的读取与写入；decision-records adapter 只继续调用既有领域与 version-control 能力。
- 新增或改变权威 Markdown、目录表、topic 表或其他 companion files 的领域选择、解析、生成与暂存语义；decision-records 迁移只复用既有行为。
- 改变查询态 `runtimeStates` overlay、持久索引同步、查询语言或任何领域的 source revision 算法。
- 实现 investigation-report 或 test-evidence 的 stage adapter。
- 建立通用 CLI、领域注册表、provider 或版本管理后端框架。

## Success Criteria

- 对同一 definition 与 snapshot，`buildStateIndexFromSnapshot` 和现有 `buildStateIndex` 产生相同的成功值或等价诊断；filesystem 同步继续复用同一条投影与完整校验路径。
- `materializeStateIndex` 只根据显式基线、变化和目标 metadata/source revision 形成完整结果，覆盖新增、替换、删除、空基线、合法空结果和 metadata 变化；所有冲突按 design 的稳定诊断失败，成员与变化排列不改变结果分类。
- 完整基线 state 在基线 metadata 下恢复旧 id，仅身份成员必须被本次变化明确消费；所有最终 state 在目标 metadata 下重新解析、投影、规范化并接受完整领域校验。
- 公共入口按 design 的 TypeScript 签名导出，不修改调用方输入，也不接收仓库、选择路径、领域文件、companion files 或 `pending`；`tools/index-runtime/` 不依赖共享 version-control。
- decision-records 继续先应用选中源文件变化，再验证完整目标；选中替换或删除可以修复无效旧决策，未选中的无效旧决策仍失败，任何失败都发生在 `pending` 写入前。
- decision-records 物化索引与目标 snapshot 的直建对照逐字节一致并能重新解析；未选择的 filesystem 变化不进入 `pending`，范围外既有 `pending` 保持不变，目标非空约束保持不变。
- 公共契约不包含 decision-records 专属语义，investigation-report 后续无需扩展公共 API 即可接入；test-evidence 接入不是完成门禁。
- index-runtime、decision-records 目标测试、确定性与规模证据、测试证据、类型检查、生成漂移和 `bun run check` 通过。

## Affected Owners

- [`tools/index-runtime/README.md`](../../tools/index-runtime/README.md)、`tools/index-runtime/src/` 与 `tools/index-runtime/tests/`：公共 snapshot 构建、选择性物化、确定性输出与验证证据。
- `tools/decision-records/src/` 与测试：首个实际消费者；源文件叠加、领域校验、companion files 和 `pending` 行为保持由 decision-records 拥有。
- [`tools/shared/version-control.md`](../../tools/shared/version-control.md)：用于核对 `pending` 范围替换仍由既有 owner 承接；本 change 不修改其接口。
- `docs/decisions/index-runtime/` 与统一决策索引：跨 change 持续有效的物化方向和责任边界。
- `docs/test-evidence/`：新增或修改最小测试入口的权威 case 与派生索引。
