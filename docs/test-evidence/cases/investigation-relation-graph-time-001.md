### Case INVESTIGATION-RELATION-GRAPH-TIME-001: relation graph rejects a target formed later

Tests:
- `test:4e572abfeea52b35c3c4bffc062551f60a2a20ffd64dd908e460bd7d795d107a`

Tags:
- `investigation-report`

Contract:
- 关系 target 的 formedAt 不得晚于 source。

Proves:
- 有效调查关系基线成功；仅将 target 的 formedAt 改为晚于 source 后图验证拒绝，不断言诊断文本。
