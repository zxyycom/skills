### Case DECISION-EVOLVE-ALIGNMENT-CONFIRMATION-001: 已建立后继的 alignment 确认

Tests:
- `test:c4f68b6f910843204ea7ed757acb56c82e9282aac5777faf3e8824884a418f21`

Tags:
- `decision-records`

Contract:
- 已建立后继被选择时其 alignment 只能确认现状，不能借 evolve 改写。

Proves:
- 扩充分组时对既有 aligned 后继错误确认 unaligned，预检拒绝且索引不变；改为 aligned 后提交成功，最终索引保留 aligned。
