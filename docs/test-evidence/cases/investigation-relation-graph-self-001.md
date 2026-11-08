### Case INVESTIGATION-RELATION-GRAPH-SELF-001: relation graph rejects a self target

Tests:
- `test:4e572abfeea52b35c3c4bffc062551f60a2a20ffd64dd908e460bd7d795d107a`

Tags:
- `investigation-report`

Contract:
- 报告不能把关系指向自身。

Proves:
- 有效调查关系基线成功；仅将 target 改为自身后图验证拒绝，不断言诊断文本。
