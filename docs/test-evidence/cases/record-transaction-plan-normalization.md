### Case RECORD-TRANSACTION-PLAN-NORMALIZATION-001: 共同计划归一化不弱化有效性与保护

Tests:
- `test:2ecb1710f2fe7cde4d2531ee4e1447af2f02692d719707e86ff5f789b1285f6e`

Tags:
- `record-operations`

Contract:
- 共同记录计划仅将表示未变的提案归为保护；所有提案仍验路径唯一性和权限，index 的提交职责、实际写入顺序及冲突保护不能丢失。

Proves:
- 归一化后只保留真实变更路径，原 index 对象保持；同路径冲突 guard 仍使事务零写入失败，alias 重复写入与对已有文件请求原生创建权限在 skip 前拒绝。
