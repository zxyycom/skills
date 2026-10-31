### Case INVESTIGATION-DISCARD-CANDIDATE-002: discard 在移动 tombstone 前复查候选漂移

Tests:
- `test:8eb359f6e66bb9b2eb188dd5f5671650bbd277e153ae0082adabdfdccff79c88`

Tags:
- `investigation-report`

Contract:
- 候选删除在移动 tombstone 前重新读取 candidate 与 owner resource 成员；漂移时零写入失败。

Proves:
- 准备后的 candidate Markdown 变化被检测，candidate 保留在 authoring workspace。
