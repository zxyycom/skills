### Case INVESTIGATION-RELATION-GRAPH-TRACE-001: Investigation Trace 整体阻断超预算拆分

Tests:
- `test:8ad09f135902ceb10e7afd2f94bbfbd10c422906f74101b2e94a7e79c44bd1b0`

Tags:
- `investigation-report`

Contract:
- Investigation trace 的预算不足以接纳完整拆分事件时，不得返回部分拆分。

Proves:
- 后继方向预算为 2 时只接纳 anchor，blockedEvent 包含完整三成员及 requiredMaxRecords=3，frontier 和 coverage 报告 max-records。
