### Case INVESTIGATION-DISCARD-CANDIDATE-003: 正式删除保留未选候选但不修复其引用

Tests:
- `test:202f67c982087d9b7e21dba68381275a94f112bde1ca6fc66cfd27fda8818c6f`

Tags:
- `investigation-report`

Contract:
- 正式 discard 不建立、删除、索引或修复未选候选，引用阻断来自正式发布图。

Proves:
- 未选候选仍引用正式 owner 时，授权删除正式 owner 资源成功而候选保留；给正式 discard 传候选 ID 返回不存在且零改写。
