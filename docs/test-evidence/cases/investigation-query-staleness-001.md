### Case INVESTIGATION-QUERY-STALENESS-001: CLI queries serve persisted snapshots with staleness warnings

Tests:
- `test:bcdb8950fd525097e9995a254f4e1565d2f83fcaaa51807dc642f718c67a6a81`

Tags:
- `investigation-report`

Contract:
- 索引型查询（list、trace、show、metadata search）在持久化快照陈旧时仍成功服务快照结果，并以 staleness warning 与 `sync-index` 恢复指引提示结论边界；内容搜索不得把陈旧投影伪装为当前内容来源。

Proves:
- 报告正文追加后 list、trace 与 metadata search 成功，stderr 含 persisted snapshot stale warning 与 `Run sync-index` 指引。
- show 输出当前报告正文，并注明 metadata 来自最后发布的快照而正文读取自当前 Markdown。
- 内容搜索发现新正文时成功列出命中，同时报告内容来源 unavailable or stale 与 `sync-index` 恢复指引。
