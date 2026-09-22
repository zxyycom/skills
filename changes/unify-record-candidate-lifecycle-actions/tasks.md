# Tasks

任务先核对状态转移与事务复用点，再实施公共动作，最后验证领域专属生命周期和删除安全没有退化。

Readiness 复核项是本 Change 的实施前审计门禁；未勾选的前置项未满足前，不得开始对应实施任务。

## Readiness

- [x] 0.1 为两个领域建立候选、正式记录、Decision archived 状态和删除确认的状态转移矩阵。
- [x] 0.2 盘点现有 publish、activate、reactivate、evolve、候选删除与正式删除的事务、锁和恢复组件，确定复用边界。
- [x] 0.3 查找适用的长期 Decision，并确认生命周期、CLI、资源与恢复对应的 Test Evidence Case。
- [ ] 0.4 确认 CLI 定位与索引陈旧状态两个前置 Change 已完成，并按最终 parser、help 与 freshness gate 复核本 Plan。

## Implementation

- [ ] 1.1 在 Decision Records 中实现只接收候选的 `publish`，保留 alignment、预检、写前验证和原子建立门禁。
- [ ] 1.2 在 Decision Records 中实现独立 `reactivate`，并让 `evolve` 继续拥有后继建立与前序生命周期组合；只稳定动作和状态边界，不提前改造后续关系 Change 拥有的输入归一化与审核协议。
- [ ] 1.3 在 Investigation Report 中把候选与正式记录删除收口为 `discard`，保持索引、资源、历史和恢复结果完整。
- [ ] 1.4 在两个领域统一 `--delete-recorded`，并在 Investigation 中保持独立的 `--delete-owned-resources` 与共享引用门禁。
- [ ] 1.5 统一 publish preflight 的准备层次、领域失败分类和结构化输出。
- [ ] 1.6 更新 parser、SDK、help，移除被取代的公开动作和目标专属 Git 删除确认参数；旧输入只走普通无效输入路径。
- [ ] 1.7 更新两个 skill、人类入口和长期 Decision，使动作选择只围绕目标状态转移展开。
- [ ] 1.8 新增或调整生命周期、删除确认、资源安全、锁与恢复测试，并同步 Test Evidence。
- [ ] 1.9 提升受影响 skill 版本并通过两个 `sync:*` 入口更新分发制品。

## Verification

- [ ] 2.1 运行两个领域的候选、发布、生命周期、discard 和恢复目标测试。
- [ ] 2.2 在隔离 Git 测试集合执行候选建立、Decision 重新启用、候选删除、正式删除、已记录目标和共享资源的双领域场景。
- [ ] 2.3 运行两个生成漂移检查、`typecheck`、`lint`、领域检查与 Test Evidence 检查。
- [ ] 2.4 运行 `bun run check`，并审阅公开 help、SDK 声明、skill 和长期 Decision 使用同一动作表面。
