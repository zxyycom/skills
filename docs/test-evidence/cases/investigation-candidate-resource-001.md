### Case INVESTIGATION-CANDIDATE-RESOURCE-001: candidate owner resources require direct reference

Tests:
- `test:e953dbdcff49169f59254b8f60827a2b2609b83fd76f8e181c1c6e214026c928`

Tags:
- `investigation-report`

Contract:
- 候选自有未引用资源使其 resource readiness 失败，不因创建候选而删除资源。

Proves:
- 已有资源时新建候选成功但 resource_ready 为 false，资源字节保持。
