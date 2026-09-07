### Case INVESTIGATION-DISCARD-CANDIDATE-002: discard-candidate rechecks source drift

Tests:
- `test:6f4bb16d2a57c7da58a78ec17fd15e3a9cb9c9c6fdd6bbbc859edd1ba828e8a2`

Tags:
- `investigation-report`

Contract:
- candidate discard 在移动 tombstone 前重新读取 candidate 与 owner resource 成员；漂移时零写入失败。

Proves:
- 准备后的 candidate Markdown 变化被检测，candidate 保留在 authoring workspace。
