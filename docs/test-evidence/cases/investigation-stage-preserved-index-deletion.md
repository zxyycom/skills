### Case INVESTIGATION-STAGE-PRESERVED-INDEX-DELETION-001: worktree 恢复不覆盖未选 pending 删除

Tests:
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`
- `test:f33c933c17e5acde3da6af37c9c3527783cd4d574dad9ba15d7bc4d4d59a9150`

Tags:
- `investigation-report`

Contract:
- index scope 以 pending 为基底，未选索引条目的 staged 删除不能被工作区恢复覆盖。

Proves:
- 共享 compose_index 纯测试中 pending 缺 B、工作区含 B、只选 A 时结果仍不含 B，revision 亦不含 B。
- IR definition 的真实 Git 测试调用同一 index-stage 投影并保留未选 pending；本组合不声称运行了 IR 索引条目删除 fixture。
