### Case INVESTIGATION-UNIFIED-DISCARD-CLASSIFICATION-001: 统一删除保留跨类型歧义与身份冲突

Tests:
- `test:078b1f2e18f1740b3c03dbacfcaecea9c8e54f271be555f6857250b707000e30`

Tags:
- `investigation-report`

Contract:
- 单锁分类不得静默选择候选或正式同name/同ID冲突，失败保持完整集合。

Proves:
- 跨候选和正式的同name以及显式同ID冲突均拒绝，index、正式正文与候选均保留。
