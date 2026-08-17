# Tasks

本 tasks 先固定行为 owner，再依次实现资源校验、索引来源和命令边界，最后同步测试证据与生成物；四条决策只能在各自完整方向经过验证后对齐。

## Readiness

- [x] 0.1 将长期方向拆成资源 owner、孤儿 warning、索引来源和选中条目暂存四条独立决策，并核对三条拆分关系与一条修订关系完整。
- [x] 0.2 核对仓库当前全部调查资源路径与报告链接，确认现有文件符合 owner 结构且无需迁移。
- [x] 0.3 读取 `investigation-report`、工具生成、Decision Records、编码规范和 Test Evidence Review 的 owner 与事务规则，确认实施和验证顺序。

## Implementation

- [ ] 1.1 先更新 `investigation-report` skill 入口、固定契约和人类说明，明确 owner 路径、errors/warnings、索引来源、四个命令的责任及 scoped check 的证明边界。
- [ ] 1.2 在资源 ID 与验证源码中实现 owner topic ID 推导、owner 参与引用校验和全量 orphan warnings，并复用现有名称、文件安全与版本控制可见性规则。
- [ ] 1.3 调整领域结果类型和 CLI 输出，使 errors 与 warnings 可区分，只有 errors 阻塞 `check` 与 `sync-index`。
- [ ] 1.4 从调查索引类型、构建器、领域校验、JSON Schema 和 source revision 移除资源 metadata、SHA 与资源池读取，保留 topic state 的 `resourceReferences`，并把 definition version 提升到 `5`。
- [ ] 1.5 调整 `list` 与 `stage-index`：list 只核对主题索引 revision；stage-index 保持 index-only staging，且资源变化不再触发调查领域集合门禁。
- [ ] 1.6 更新或新增最小原生测试，覆盖 owner 与共享引用、orphan warning、ignored 未跟踪与 `git add -f`、空 metadata、list 新鲜度和无关资源变化下的 topic staging；同步每个保留入口对应的测试证据 case。
- [ ] 1.7 提升 skill version，从维护源码生成 CLI、source map 和 Schema，重建当前调查索引及测试证据索引，并确认仓库资源无需移动。

## Verification

- [ ] 2.1 独立运行全部新增或修改的 investigation-report 最小测试节点，再运行 `bun run test:investigation-report-check`。
- [ ] 2.2 运行生成一致性、当前调查全量检查与查询、Decision Records 检查和 Test Evidence 目录检查，确认没有生成物、索引或账本漂移。
- [ ] 2.3 在临时 Git 工作区验证：主题 B 的资源变化不阻塞主题 A 的 `stage-index`；ignored binary 未跟踪时引用失败，经 `git add -f` 后引用通过且不带入无关 pending。
- [ ] 2.4 运行 `bun run check`，审阅最终 diff 只覆盖本 Change 的行为 owner、实现、生成物、当前索引、测试证据与决策状态。
- [ ] 2.5 对照四条决策分别核验当前事实；只有完整方向已生效并通过对应证据时才标记 aligned，然后再次运行严格决策检查。
