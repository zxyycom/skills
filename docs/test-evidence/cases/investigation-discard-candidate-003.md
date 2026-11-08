### Case INVESTIGATION-DISCARD-CANDIDATE-003: 正式删除保留未选候选但不修复其引用

Tests:
- `test:6eeb2843d20f2ca1d340f822753e6dcdfd7e88748e2ca03a73247abe94ccca45`

Tags:
- `investigation-report`

Contract:
- 正式 discard 不检查或修复未选候选的引用。

Proves:
- 未选候选仍有指向正式目标的关系时，正式 owner 与资源删除成功，候选字节保留。
