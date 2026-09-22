### Case DECISION-STAGE-SCOPE-FIRST-COLLECTION-001: stage --scope domain preserves an unrelated pending index byte-for-byte after source drift is absent

Tests:
- `test:d1d3d42a634e4b2f9a7ec62f410e5f668e2dee2a4f2ab28f115d15cff091013e`

Tags:
- `decision-records`

Contract:
- 无 revision 基线的首个集合也能分别使用 index 与 domain scope。

Proves:
- 新建 Decision 先 index 后 domain 后，pending 索引字节保持 index 结果，所选 Markdown 进入 pending。
