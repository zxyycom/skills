### Case CHANGE-PLAN-COMPLETE-008: Complete 在 lifecycle 或 HEAD 漂移时停止
Entry:
- `tools/change-plan/tests/complete.test.ts > complete stops when the Plan lifecycle changes while tombstone setup runs`
- `bun test --test-name-pattern="^complete stops when the Plan lifecycle changes while tombstone setup runs$" ./tools/change-plan/tests/run.ts`
Contract:
- actual complete 必须在 tombstone root 建立后重新读取 Plan、任务、base 与 HEAD，并与起始快照闭合；任何 lifecycle 或 revision 漂移都不得删除 source。
Proves:
- hook 在 tombstone setup 后把完成任务改为未完成并提交新 HEAD 时，结果为 `no-change`。
- source Change 仍存在，未进入删除或 cleanup 流程。
