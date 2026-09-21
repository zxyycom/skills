# Tasks

任务先审计逐路径映射与 Change 依赖，再实现 scope 和 owner 资源快照，最后验证 pending 隔离与漂移保护。

Readiness 复核项是本 Change 的实施前审计门禁；未勾选的前置项未满足前，不得开始对应实施任务。

## Readiness

- [x] 0.1 为两个现有 staging 入口建立当前集合、`HEAD` 基线、索引、正式 Markdown、owner 资源和删除路径的逐路径矩阵。
- [x] 0.2 确认 `unify-record-cli-location-and-help` 的目标定位契约可供 stage 使用，并审阅共享 pending replacement 的最小复用边界。
- [x] 0.3 查找适用的长期 Decision，并确认 staging、资源、删除、漂移和版本控制对应的 Test Evidence Case。
- [ ] 0.4 确认 CLI 定位与索引陈旧状态两个硬前置已完成，并按最终 location 与 freshness gate 复核 staging service。
- [ ] 0.5 在接入公共 parser、SDK、help 和生成制品前，确认候选生命周期与关系维护已经稳定最终命令表面。

## Implementation

- [ ] 1.1 定义两个领域共同的 scope、selector 与结构化结果协议，并保持领域路径发现与共享 Git 写入的 owner 边界。
- [ ] 1.2 扩展 Decision Records `stage`，支持 `all`、`index`、`domain` 和基线-only ID，同时保留现有 pending CAS 与无关内容保护。
- [ ] 1.3 将 Investigation Report staging 收口为 `stage`，实现正式报告与完整 owner 资源树的工作区/`HEAD` 并集准备。
- [ ] 1.4 为 Investigation owner 资源新增、修改、删除、未引用成员和其他 owner 隔离实现写前漂移验证。
- [ ] 1.5 实现两个领域的重命名显式双 selector、删除投影、同步/全量检查门禁和实际路径输出。
- [ ] 1.6 更新 CLI parser、help 与 SDK，移除被取代的 `stage-index` 公共入口并采用共同 scope；旧输入只走普通无效输入路径。
- [ ] 1.7 更新两个 skill、人类入口和长期 Decision，明确 pending、commit 与 push 的责任边界。
- [ ] 1.8 新增或调整 scope、删除、重命名、owner 资源、无关 pending、CAS 和恢复测试，并同步 Test Evidence。
- [ ] 1.9 提升受影响 skill 版本并通过两个 `sync:*` 入口更新分发制品。

## Verification

- [ ] 2.1 运行两个领域的 staging、版本控制、索引投影、资源和 CLI 目标测试。
- [ ] 2.2 在临时 Git 工作区执行三种 scope 的新增、更新、删除、重命名、完整 owner 资源树和其他 owner 隔离场景。
- [ ] 2.3 注入 `HEAD`、pending、来源字节和资源成员漂移，确认写入保持原子且无关 pending 内容不变。
- [ ] 2.4 运行两个生成漂移检查、`typecheck`、`lint`、领域检查与 Test Evidence 检查。
- [ ] 2.5 运行 `bun run check`，并审阅公开 help、SDK、skill 与长期 Decision 使用同一 scope 契约。
