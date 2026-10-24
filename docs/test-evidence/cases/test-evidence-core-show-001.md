### Case TEST-EVIDENCE-CORE-SHOW-001: Show 拒绝原位追加造成的 revision 漂移

Tests:
- `test:4b1dc4fdfd3d91f5b91b0df6fbb4ef1d85458acb4eb8e731ec3b0ba188d5c1e3`

Tags:
- `test-evidence`

Contract:
- show 必须核对索引 revision 与当前 Case 原文，不得把追加后的来源作为旧快照返回。

Proves:
- Case 原位追加后 show 返回 index-stale 且 Case=null，明确提示 revision 漂移；该节点不声称 inode 替换或搜索正文覆盖。
