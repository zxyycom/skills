### Case CHANGE-PLAN-COMPLETE-006: 预演在删除前重验 target、成员与 HEAD
Entry:
- `tools/change-plan/tests/complete.test.ts > prepared deletion revalidates tombstone target, members, and HEAD before deletion`
- `bun test --test-name-pattern="^prepared deletion revalidates tombstone target, members, and HEAD before deletion$" ./tools/change-plan/tests/run.ts`
Contract:
- 预演不建立删除提交点；实际删除前必须重新确认 tombstone child 不存在、每个 member 未漂移且 HEAD 相同。
Proves:
- 后出现的 tombstone target、已读取文件内容变化、及 HEAD 前进各自返回 `no-change`。
- 每种重验失败都保留 source Change。
