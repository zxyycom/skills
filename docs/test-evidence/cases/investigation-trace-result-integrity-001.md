### Case INVESTIGATION-TRACE-RESULT-INTEGRITY-001: 追溯拒绝缺失成员的发布图

Tests:
- `test:e9144de73a3685f9d54beacff2b33990872f79ab7c9fb0abf579f3b0a6a66c71`

Tags:
- `investigation-report`

Contract:
- trace 成功时 trace/context 互斥且并集精确等于 entries；非法完整图失败。

Proves:
- 合法图的完整成员严格相等；将已发布关系 target 改为不存在的 ID 后，trace 返回领域失败而非遗漏成员的成功 envelope。
