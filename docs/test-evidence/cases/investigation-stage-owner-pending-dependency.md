### Case INVESTIGATION-STAGE-OWNER-PENDING-DEPENDENCY-001: pending 缺少共享资源 owner 时要求补选

Tests:
- `test:e704ef9fd4e63ca397aeb6efc38ca83ec78dbdb3a174df346c0ec54d1277c609`

Tags:
- `investigation-report`

Contract:
- all 检查必要 owner 的 pending 来源，缺失依赖要求显式补选，不自动暂存其他 owner。

Proves:
- 所选报告引用的 owner 正文被 staged 删除时，单选失败且 pending 不变；显式同选 owner 后成功恢复完整配套暂存。
