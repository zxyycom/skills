### Case INVESTIGATION-DISCARD-CANDIDATE-002: discard 在移动 tombstone 前复查候选漂移

Tests:
- `test:3b63376647e96e9debea895f8e474e973dccb7f267971f2b26261f02359aae3a`

Tags:
- `investigation-report`

Contract:
- 候选删除在移动 tombstone 前重新读取 candidate 与 owner resource 成员；漂移时零写入失败。

Proves:
- 准备后的 candidate Markdown 变化被检测，candidate 保留在 authoring workspace。
