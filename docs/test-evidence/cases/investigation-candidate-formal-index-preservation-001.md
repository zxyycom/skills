### Case INVESTIGATION-CANDIDATE-FORMAL-INDEX-PRESERVATION-001: 候选删除计划不发布正式索引

Tests:
- `test:7f473c36cc7dd9a13647c768927fa1782093fb6c28be94828abf6088c1a45d4f`

Tags:
- `investigation-report`

Contract:
- 候选 discard 的删除计划不发布正式索引。

Proves:
- 无 owner 资源候选的纯删除计划返回 publish_index=false。
