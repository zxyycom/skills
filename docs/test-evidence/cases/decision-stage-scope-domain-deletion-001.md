### Case DECISION-STAGE-SCOPE-DOMAIN-DELETION-001: stage --scope domain writes a deletion for a baseline-only ID without touching the pending index

Tests:
- `test:fc7c5c7a3633d38d2e2b01298eb5fb0cf5b1a5507a9b616da38f0066782702eb`

Tags:
- `decision-records`

Contract:
- 基线-only ID 在 domain scope 写入正式 Markdown 删除，pending 索引不受影响。

Proves:
- 暂存区含所选旧 ID 的删除记录；索引无 cached 差异。
