# Tasks

任务先固定共同关系协议与领域边界，再实现两个入口，最后验证原子性、图规则和审核输出。

Readiness 复核项是本 Change 的实施前审计门禁；未勾选的前置项未满足前，不得开始对应实施任务。

## Readiness

- [x] 0.1 对照两个领域的关系输入、规范化、摘要、图验证、事务与审核输出，形成共同协议和领域专属规则清单。
- [x] 0.2 审阅 Decision `evolve` 的关系准备边界，确定可复用组件以及 `set-relations` 不得触及的生命周期状态。
- [x] 0.3 查找适用的长期 Decision，并确认关系、CLI、事务与恢复对应的 Test Evidence Case。
- [ ] 0.4 确认候选生命周期及其 CLI、索引前置已完成，并按最终 `evolve` 状态职责复核关系协议与实现入口。

## Implementation

- [ ] 1.1 在 Decision Records 中实现 `set-relations` CLI、SDK 和只修改正式关系与索引的原子事务。
- [ ] 1.2 让 Decision `evolve` 复用共同规范化、摘要绑定与审核结果，并把分组参数统一为 `--source`。
- [ ] 1.3 让 Investigation Report `set-relations` 对齐共同分组、错误分类、排序和结构化审核结果。
- [ ] 1.4 只在维护面确实下降时提取共享协议或运行时组件，并保持领域图验证由各领域调用。
- [ ] 1.5 更新两个 CLI 的 help、parser 和 SDK 声明，使公开语法只包含目标参数；旧参数只走普通无效参数路径。
- [ ] 1.6 更新两个 skill、人类入口和长期 Decision，明确 `set-relations` 与 `evolve` 的唯一选择条件。
- [ ] 1.7 新增或调整完整替换、清空、摘要、重复输入、多 source 原子性、漂移和恢复测试，并同步 Test Evidence。
- [ ] 1.8 提升受影响 skill 版本并通过两个 `sync:*` 入口更新分发制品。

## Verification

- [ ] 2.1 运行两个领域的关系、图验证、事务、CLI 和恢复目标测试。
- [ ] 2.2 在隔离测试集合执行单 source、多 source、clear、summary 失配、图非法和写前漂移的双领域 A/B。
- [ ] 2.3 运行两个生成漂移检查、`typecheck`、`lint`、领域检查与 Test Evidence 检查。
- [ ] 2.4 运行 `bun run check`，并审阅公开 help、SDK、skill 与长期 Decision 使用同一关系协议。
