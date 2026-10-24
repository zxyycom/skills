### Case INVESTIGATION-UNIFIED-DISCARD-CLASSIFICATION-001: 统一删除保留跨类型歧义与身份冲突

Tests:
- `test:15df091b933655c6ff6d03f80a50ef23014950d6a230e510ff2665f4260e6470`

Tags:
- `investigation-report`

Contract:
- 单锁分类不得静默选择候选或正式同name/同ID冲突，失败保持完整集合。

Proves:
- 跨候选和正式的同name以及显式同ID冲突均拒绝，index、正式正文与候选均保留。
