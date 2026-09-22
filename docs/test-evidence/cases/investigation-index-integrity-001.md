### Case INVESTIGATION-INDEX-INTEGRITY-001: list serves the persisted snapshot with a staleness warning on unreadable sources

Tests:
- `test:7f3d585d026f0f38872543d8f5571d78347cf7036a174c21119148f1c52fa5eb`

Tags:
- `investigation-report`

Contract:
- 索引型查询在报告源与持久化投影不一致时不再阻断读取：继续服务最后发布的快照，并以 staleness warning 提示先 `sync-index` 再对完整集合下结论。

Proves:
- 报告源改写后 list 返回快照条目与零 error，warnings 恰好是一条指向 `sync-index` 的 staleness 提示。
