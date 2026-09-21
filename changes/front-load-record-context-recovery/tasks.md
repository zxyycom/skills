# Tasks

任务先等待记录 CLI 与 mutation 表面稳定，再把上下文恢复前置到两个 skill，最后验证查询 help 与调查分流一致。

Readiness 复核项是本 Change 的实施前审计门禁；未勾选的前置项未满足前，不得开始对应实施任务。

## Readiness

- [x] 0.1 确认已有调查命中时的产品体验：当前性意图不明确则提供复用既有结论或按当前事实复查的选择，明确意图直接执行。
- [ ] 0.2 确认五个前置记录 Change 已完成，并按最终命令、query warning、help renderer 与 freshness gate 复核本 Plan。
- [ ] 0.3 盘点最终 skill 查询入口、命令级 help、适用长期 Decision 与 Test Evidence Case，确认语义说明只在 owner 完整表达。

## Implementation

- [ ] 1.1 更新 Decision Records skill，把最小查询与完整读取前置到候选建立和长期判断维护之前，并明确查询停止条件。
- [ ] 1.2 更新 Investigation Report skill，实现已有报告的概述、复用/复查选择和明确当前性意图的直接分流。
- [ ] 1.3 在最终 help renderer 上扩展两个 CLI 的 `list` 与 `search` 语义、结果边界、warning 和 `show` 后续入口，不复制固定契约。
- [ ] 1.4 更新两个人类入口与长期 Decision，使记录恢复顺序和调查体验与 skill 一致。
- [ ] 1.5 新增或调整查询 help 与分流相关测试，并同步 Test Evidence Case 与索引。
- [ ] 1.6 提升受影响 skill 版本并通过两个 `sync:*` 入口更新分发制品。

## Verification

- [ ] 2.1 运行两个 CLI 的 query/help 目标测试，覆盖 selector、metadata、正文搜索、candidate 边界、warning 与后续完整读取说明。
- [ ] 2.2 用“复用已有材料”“普通调查一下”“当前或最新调查”三类代表任务审阅 skill，确认分别直接复用、询问选择和直接复查。
- [ ] 2.3 运行两个生成漂移检查、`typecheck`、`lint`、领域检查与 Test Evidence 检查。
- [ ] 2.4 运行 `bun run check`，并审阅 skill、help、人类入口和长期 Decision 没有重复 owner 或旧命令残留。
