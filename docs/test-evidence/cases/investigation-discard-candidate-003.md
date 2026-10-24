### Case INVESTIGATION-DISCARD-CANDIDATE-003: 正式删除保留未选候选但不修复其引用

Tests:
- `test:9280377c6b8cb49c2f34af02bd4d0eae319429ac8dc53bc5daf21de79306a9ae`

Tags:
- `investigation-report`

Contract:
- 正式 discard 不建立、删除、索引或修复未选候选，引用阻断来自正式发布图。

Proves:
- 未选候选仍引用正式 owner 时，授权删除正式 owner 资源成功而候选保留；给正式 discard 传候选 ID 返回不存在且零改写。
