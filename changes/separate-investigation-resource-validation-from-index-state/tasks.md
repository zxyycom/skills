# Tasks

实施先固定行为 owner，再依次调整资源校验、索引来源和命令边界，最后同步测试证据与生成物；四条决策只能在各自完整方向经过验证后对齐。

## Readiness

- [x] 0.1 将长期方向拆成资源 owner、孤儿 warning、索引来源和选中条目暂存四条独立决策，并核对三条拆分关系与一条修订关系完整。
- [x] 0.2 核对仓库当前全部调查资源路径与报告链接，确认现有文件符合 owner 结构且无需迁移。
- [x] 0.3 读取 `investigation-report`、工具生成、Decision Records、编码规范和 Test Evidence Review 的 owner 与事务规则，确认实施和验证顺序。
- [x] 0.4 按 AI-Ready Docs 审计 proposal、design 和 tasks，确认目标、严重性、owner、命令边界、兼容路径与验证任务一致，且没有阻塞实施的开放问题或临时状态副本。

## Implementation

- [ ] 1.1 先更新 `investigation-report` skill 入口、固定契约和人类说明，明确 owner 路径、所有未引用资源只报告 warnings、资源检查无法完成时的 errors、索引来源、四个命令的责任、scoped check 的证明边界及 version 5 首次整体升级路径。
- [ ] 1.2 在资源 ID 与验证源码中分离成员发现、全量引用收集和被引用资源校验，实现 owner topic ID 推导、owner 参与引用校验、全量 orphan warnings 及资源检查操作失败，并复用现有名称、文件安全与版本控制可见性规则。
- [ ] 1.3 调整源码类型和 `tools/investigation-report/api/check-investigations.d.mts`，让 check/sync 公开结果分别包含确定性 `errors` 与 `warnings`；调整 CLI 在成功和失败路径展示 warnings，并保持只有 errors 阻塞 `check` 与 `sync-index`。
- [ ] 1.4 从调查索引类型、构建器、领域校验、JSON Schema 和 source revision 移除资源 metadata、SHA 与资源池读取，保留 topic state 的 `resourceReferences`，使用严格空 metadata，保持 schema version 3 并把 definition version 提升到 `5`。
- [ ] 1.5 调整 `check`、`sync-index`、`list` 与 `stage-index` 的调用路径：sync 先校验资源再只构建主题索引；list 只核对主题 revision；stage-index 保持 index-only staging，且同为 version 5 时资源成员或字节变化不再触发调查领域集合门禁。
- [ ] 1.6 更新或新增最小原生测试，覆盖 owner 前缀与 owner 引用、跨主题共享、各种未引用资源问题只产生 warning、资源根或版本控制查询失败导致检查无法完成、ignored 未跟踪与 `git add -f`、公开 warnings 结果与 CLI 退出、严格空 metadata、资源变化后的 list 新鲜度及 version 5 无关资源变化下的 topic staging；改写或移除三个仍声明 orphan、资源 revision 或资源 metadata 会阻塞的过时测试与测试证据 case，并同步每个保留入口对应的 case。
- [ ] 1.7 把 skill version 从 `15` 提升到 `16`，从维护源码生成 CLI、source map、TypeScript 声明和 Schema，重建当前调查索引与测试证据索引，并再次确认仓库资源无需移动。

## Verification

- [ ] 2.1 按测试文件与名称独立运行全部新增或修改的 investigation-report 最小测试节点，再运行 `bun run test:investigation-report-check`。
- [ ] 2.2 运行 `bun run check:investigation-report-check`、`bun run check:investigations`、`bun run investigation-report -- list`、`bun run check:decisions` 和 `bun run check:test-evidence-catalog`，确认生成物、调查索引、决策索引和测试证据账本没有漂移。
- [ ] 2.3 在临时 Git 工作区验证：两侧已有 version 5 索引时，主题 B 的资源新增、删除、改名或字节变化不阻塞主题 A 的 `stage-index`；ignored binary 未跟踪时引用失败且不产生 orphan warning，经 `git add -f` 后引用通过，未引用时产生 warning，且两条路径都不带入主题、资源或目标索引之外的 pending。
- [ ] 2.4 运行 `bun run check`，审阅最终 diff 只覆盖本 Change 的行为 owner、实现、生成物、当前索引、测试证据与决策状态。
- [ ] 2.5 对照四条决策分别核验当前事实；只有完整方向已生效并通过对应证据时，才逐条运行 `bun run decision-records -- mark-aligned <decision-id>`，确认 `docs/decisions/decision-index.json` 同步更新，然后再次运行 `bun run check:decisions`。
