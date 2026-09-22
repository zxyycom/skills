### Case INVESTIGATION-DISCARD-CANDIDATE-002: discard 在移动 tombstone 前复查候选漂移

Tests:
- `test:066379b77812d266a9d83d2555222ca47e105788d64ddbbfcaef55a5c65caf13`

Tags:
- `investigation-report`

Contract:
- 候选删除在移动 tombstone 前重新读取 candidate 与 owner resource 成员；漂移时零写入失败。

Proves:
- 准备后的 candidate Markdown 变化被检测，candidate 保留在 authoring workspace。
