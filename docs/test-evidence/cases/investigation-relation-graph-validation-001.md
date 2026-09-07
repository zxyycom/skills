### Case INVESTIGATION-RELATION-GRAPH-VALIDATION-001: relation graph rejects a missing target

Tests:
- `test:d88fb5574c8a41c40078991f76e81b8e946b29937dc8b91595fca7c7d04443f3`

Tags:
- `investigation-report`

Contract:
- 报告关系的 target 必须属于当前报告集合。

Proves:
- 指向缺失报告的关系返回 missing-target 诊断。
