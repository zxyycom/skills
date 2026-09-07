### Case INVESTIGATION-RELATION-GRAPH-DUPLICATE-001: relation graph rejects a repeated target

Tests:
- `test:b1c4446f77bb2f85b87c4fbd0fef383f41d8b77e9339dd602fc3d9724b6d170b`

Tags:
- `investigation-report`

Contract:
- 同一报告不能向同一 target 声明多个关系类型。

Proves:
- 重复 target 恰好返回一条可定位的重复关系诊断。
