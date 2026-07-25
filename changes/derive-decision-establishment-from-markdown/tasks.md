# Tasks

任务先收敛生命周期事实源，再移除 Git 边界并更新决策基线，完成出口是 decision-records 在非 Git 根目录中也能完整维护。

## Readiness

- [x] 0.1 核对三个 artifact 都以“由 Markdown 生命周期决定候选和已建立状态”为目标，并确认计划顺序是 metadata、建立状态、领域路径迁移。
- [x] 0.2 重新搜索源码、测试、skill 文档、人类介绍、恢复手册和活动决策中的 `HEAD`、`pending`、`headDecisionPaths` 与 Git 根目录要求，记录完整清理清单。
- [x] 0.3 核对 `decision-records` 与 `decision-records-skill` 中全部活动 HEAD/pending 决策及其直接关系，确定需要归档的前序和一条能够独立表达当前结论的新决策。
- [x] 0.4 确认 `decision-records/use-controlled-decision-domains.md` 是未进入 Git 基线的中间记录、没有其他记录引用，并记录必须在生命周期切换前执行的丢弃操作。
- [x] 0.5 确认 `Open Questions` 为“无”，新的候选、已建立、索引成员和关系语义足以直接实施。

## Implementation

- [x] 1.1 使用当前 decision-records 维护语义丢弃未进入 Git 基线的 `decision-records/use-controlled-decision-domains.md`，避免中间方案跨过新的建立状态边界。
- [x] 1.2 重写扫描、查询新鲜度与索引选源，使候选由合法 `createdAt: null` 组合识别，全部合法非空 `createdAt` Markdown 组成已建立集合和索引源，旧索引之外新增的已建立文件会使查询拒绝陈旧结果，并删除 `registerPaths`、`includeUnindexedPaths`、`findIndexedRecord` 等旧索引登记分支。
- [x] 1.3 从验证上下文、严格检查、关系检查和事务参数中移除 HEAD 路径集合，并删除 `head-decision-paths` 模块及 decision-records 对 version-control 的运行时依赖。
- [x] 1.4 调整 activate、archive、discard、sync-index 和事务回滚：激活建立记录，归档接受活动已建立记录，丢弃只接受候选，索引从全部已建立记录重建。
- [x] 1.5 从 list、show、trace、成功消息、warning、错误、公共类型和 `--help` 中移除 pending 与 Git 专用语义，同时保留未激活候选逐条提醒。
- [x] 1.6 更新 `SKILL.md`、固定契约、恢复手册和人类介绍，使 Markdown、索引与关系的 owner 分工一致。
- [x] 1.7 归档或修订仍活动的 HEAD/pending 决策，新增自包含的“Markdown 生命周期决定建立状态”决策，并确保关系只指向归档直接前序。
- [x] 1.8 从生成源重建 decision-records 的 MJS、声明、source map 与 schema；与同组 change 共用相对基线的一次最终 skill 版本提升。

## Verification

- [x] 2.1 用新的生命周期测试替换 HEAD presence 测试，覆盖候选识别、首次激活、重复激活、归档、只允许候选丢弃和剩余候选严格失败。
- [x] 2.2 移除 decision-records 测试支持层的 Git 初始化与专用 helper，并增加真正的非 Git 决策根目录端到端测试，证明 check、list、show、trace、sync-index 和状态命令不读取 Git。
- [x] 2.3 覆盖索引有效、缺失、损坏、陈旧及候选共存时的完整重建与普通失败回滚，并验证旧索引之外新增非空 `createdAt` 文件会先使查询拒绝陈旧结果、同步后自动成为正常索引成员。
- [x] 2.4 覆盖关系目标必须是当前扫描到的已建立归档记录，以及缺失、候选、活动、重复、自环和环路失败。
- [x] 2.5 运行 decision-records 行为测试、生成漂移检查、`bun run typecheck` 和 `bun run check`，确认没有残余 HEAD 成员判断、pending 状态或 Git 运行时依赖。
- [x] 2.6 语义审阅活动决策、skill 行为和固定契约，确认它们对候选、生效、建立、索引成员和丢弃的描述互相一致。
