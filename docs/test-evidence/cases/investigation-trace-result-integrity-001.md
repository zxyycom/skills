### Case INVESTIGATION-TRACE-RESULT-INTEGRITY-001: 追溯拒绝缺失成员的发布图

Tests:
- `test:2b65fbd0378f0e611a5eee1918af3ea11cfada79c47e58012e3e81dcbbb7abe0`

Tags:
- `investigation-report`

Contract:
- trace 成功时 trace/context 互斥且并集精确等于 entries；非法完整图失败。

Proves:
- 合法图的完整成员严格相等；将已发布关系 target 改为不存在的 ID 后，trace 返回领域失败而非遗漏成员的成功 envelope。
