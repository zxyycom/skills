### Case CHANGE-PLAN-FINALIZE-008: Finalize 在 lifecycle 或 HEAD 漂移时停止

Tests:
- `test:835b5d1904ae762d4ea4707eadf0a17d520188bd5a2f375e98863981ab00e49d`

Tags:
- `change-plan`

Contract:
- 实际 finalize 必须在 tombstone root 建立后重新读取 Plan、任务、base 与 HEAD，并与起始快照闭合；任何 lifecycle 或 revision 漂移都不得删除 source。

Proves:
- hook 在 tombstone setup 后把完成任务改为未完成并提交新 HEAD 时，结果为 `no-change`。
- 该失败结果保留刷新后的 check，因而报告当前的未完成任务进度而不是初始快照。
- source Change 仍存在，未进入删除或 cleanup 流程。
