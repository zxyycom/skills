# Tasks

任务按“实施门禁 → 公共契约 → index-runtime 实现 → decision-records 迁移 → 证据与对齐”推进；完成出口是公共能力与首个领域接入通过全部验证，并同步长期 owner。

## Readiness

- [x] 0.1 核对领域派生索引、`pending`、Git index、权威源和 companion files 的术语与 owner，确认本 change 只修改索引构建与物化，不接管领域源或版本管理写入。
- [x] 0.2 核对现有 `StateSnapshot` builder、查询态 `runtimeStates` overlay、完整验证、revision 语义和 decision-records stage，确认 snapshot 直建与 delete/目标 metadata/source revision 的选择性物化仍是公共缺口。
- [x] 0.3 确认保留 decision-records 既有 target-first 行为：先应用选中变化，再验证完整目标，不要求即将被替换或删除的旧源先通过当前 parser；公共基线使用完整 state 成员与必须被变化消费的仅身份成员。
- [x] 0.4 完成 AI-ready 语义审计：确认 decision-records 与 investigation-report 是两个主要现实消费者，test-evidence 是可选消费者；三个 artifact 的范围、术语、公共契约、target-first 迁移、成功标准和验证任务一致，讨论过程描述已经清除，且 `Open Questions` 为“无”。

## Implementation

- [ ] 1.1 新增 `docs/decisions/index-runtime/materialize-selected-state-index.md`，记录 decision-records 与 investigation-report 的长期并行选择需求、纯内存完整索引物化、来源一致性、companion files 与 `pending` 边界，并说明它不改变 filesystem 完整同步协议。
- [ ] 1.2 提取并公开 `buildStateIndexFromSnapshot`，让现有 `buildStateIndex` 与 filesystem 同步在 source read 后复用同一 snapshot 投影、规范化和完整校验路径。
- [ ] 1.3 按 design 导出 `StateIndexBaseline`、完整 state/仅身份成员和选择变化类型，并实现运行时输入校验、基线恢复、变化归并、固定诊断与不修改调用方输入的边界。
- [ ] 1.4 实现 `materializeStateIndex`：执行仅身份成员消费门禁，用目标 metadata/source revision 重新投影完整目标，并通过 `buildStateIndexFromSnapshot` 完成规范化与完整校验。
- [ ] 1.5 迁移 decision-records stage adapter：先完成选中源文件叠加与完整目标校验，再从 revision 成员、选中路径和目标 state 构造基线成员与变化，以选择性物化结果生成最终索引；`buildDecisionIndexFromSnapshot` 改为直接复用 snapshot 直建入口，不再覆盖 `definition.read`。
- [ ] 1.6 更新 index-runtime README、公共导出与声明、受影响 decision-records 实现说明和必要生成产物；不把 investigation-report 或 test-evidence 的 adapter 写入本 change。
- [ ] 1.7 在实现、稳定 owner 和事实核对完成后，把本 change 对应的长期决策标记为 `aligned` 并同步统一决策索引。

## Verification

- [ ] 2.1 验证 snapshot 直建与现有 builder 对同一成功、definition 无效、开始前取消、reader 返回后取消、snapshot 外形无效、metadata/state 无效和 `validateIndex` 失败输入产生相同结果或等价诊断。
- [ ] 2.2 验证选择性物化的完整 state 成员、仅身份成员、新增、同 id 替换、`replaceId` 替换、delete、delete + upsert、空基线、合法空结果、metadata 变化、目标 source revision、保留 state 重新投影和完整后置校验。
- [ ] 2.3 验证仅身份成员未消费、缺失基线 id、基线 id 重复、重复消费、`delete` 与 `replaceId` 冲突、多个 upsert 目标冲突和 metadata 变化后的目标 id 冲突使用 design 固定的 code、path 与 `stateId`；同阶段诊断稳定排序，成员/变化排列不改变结果或诊断 code/`stateId` 集合。
- [ ] 2.4 增加 decision-records 基线修复回归，证明选中的无效旧决策可以被合法替换或删除，未选中的无效旧决策仍随完整目标校验失败，且失败发生在任何 `pending` 写入前。
- [ ] 2.5 回归查询态 `runtimeStates` overlay、filesystem sync、解析、reader、序列化、field order 和确定性；在既有 1,000/5,000 state 规模测试中加入选择性物化，并沿用现有增长界限检查明显超线性退化，不建立持续性能 SLO。
- [ ] 2.6 回归 `bun run test:decision-records-cli` 覆盖的 stage 与非 stage 命令，至少确认新增、修改、删除、显式重命名、首次集合、拒绝空目标、并行未选择变化、既有同领域/范围外 `pending`、领域关系失败、同源权威文件和 `sourceRevision` 保持一致。
- [ ] 2.7 增加 decision-records 接入证据，证明 stage 先验证目标源、再构造基线成员与变化，最终索引来自选择性物化入口，其确定性序列化与完整目标 snapshot 的直建对照逐字节一致，并且 snapshot 直建不再覆盖 `definition.read`。
- [ ] 2.8 为新增或修改的最小测试入口维护独立测试证据 case 并同步统一索引；运行 `bun run test:index-runtime`、`bun run test:decision-records-cli`、类型检查、生成漂移、严格目录检查和 `bun run check`，最后审阅依赖方向与 diff。
