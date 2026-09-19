# Tasks

先闭合术语和影响面，再同步公开契约、长期记录与证据，最后验证删除安全行为没有变化。

## Readiness

- [x] 0.1 读取 Change Plan 行为 owner、固定 CLI 契约、当前 active 决策和测试证据，确认术语混淆发生在任务进度、语义验收和生命周期动作之间。
- [x] 0.2 确定概念模型：使用“结项（`finalize`）”命名动作，以删除目录作为成功效果，并保持 OpenSpec archive 独立。
- [ ] 0.3 实施前复核完整影响面和并行改动，确认公开表面、Gate Check、Case、生成物及 skill 版本入口均已纳入。

## Implementation

- [ ] 1.1 更新 Change Plan 的 SKILL、固定契约、agent 提示、人类入口、仓库概览与版本，统一术语模型、授权边界和生命周期表达。
- [ ] 1.2 将 CLI 领域包装、公开导出、帮助、诊断和 JSON 成功 outcome 迁移到 finalize/finalized，并让旧动作词沿 usage error 退出。
- [ ] 1.3 同步 Change Plan 测试、Vibe Gate Check 与 fixture，再重建分发 MJS 和 source map。
- [ ] 1.4 建立 finalization 长期决策，以修订关系承接并归档 `260904-current-change-plan-completion`，同步决策索引。
- [ ] 1.5 重审受影响测试证据，将当前 COMPLETE Case 迁移为 FINALIZE Case，更新真实 Tests token、Contract、Proves 和索引。

## Verification

- [ ] 2.1 运行 Change Plan 目标测试、生成一致性、typecheck、lint 与 format 检查，覆盖 finalize 的成功、失败、恢复、CLI 和 import 契约。
- [ ] 2.2 生成项目测试实体快照并运行 Test Evidence 引用/覆盖检查、Case `check` 与 Decision Records `check`。
- [ ] 2.3 搜索当前维护表面的旧动作词，逐项确认剩余命中只属于任务进度、删除实现或历史记录。
- [ ] 2.4 运行 `bun run check`，验证 skill、文档、工具、Gate、账本和生成制品的项目级一致性。
