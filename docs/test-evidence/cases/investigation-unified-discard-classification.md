### Case INVESTIGATION-UNIFIED-DISCARD-CLASSIFICATION-001: 统一删除保留跨类型歧义与身份冲突

Tests:
- `test:7fbbd2b1f22373914be0fe0bedcf421256d13cba024017aa55fe257837325939`

Tags:
- `investigation-report`

Contract:
- 统一 discard 不得静默选择正式与候选的同名歧义或同 ID 冲突。

Proves:
- 跨类型同名选择及同 ID 冲突均失败，正式正文、候选和索引保留。
