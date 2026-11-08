### Case DECISION-STAGE-SCOPE-DOMAIN-DELETION-001: stage --scope domain writes a deletion for a baseline-only ID without touching the pending index

Tests:
- `test:4691cf2c8637483cd21549abc275c580c5a0f96381278da706750cc86e8d57d1`

Tags:
- `decision-records`

Contract:
- domain scope 暂存所选正文删除，不改 pending 索引。

Proves:
- 真实 Git 中所选正文被删除且工作区索引不再含该身份；domain 清除对应 pending 正文，保留原索引字节与无关 pending。
