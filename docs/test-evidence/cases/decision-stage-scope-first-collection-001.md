### Case DECISION-STAGE-SCOPE-FIRST-COLLECTION-001: stage --scope domain preserves an unrelated pending index byte-for-byte after source drift is absent

Tests:
- `test:d1d3d42a634e4b2f9a7ec62f410e5f668e2dee2a4f2ab28f115d15cff091013e`

Tags:
- `decision-records`

Contract:
- domain scope 只刷新选中领域来源，保持已经暂存的索引字节。

Proves:
- 显式发布工作区投影后先 index 再 domain 暂存均成功，domain 更新目标正文但 pending 索引逐字节不变。
