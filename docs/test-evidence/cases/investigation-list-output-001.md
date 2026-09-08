### Case INVESTIGATION-LIST-OUTPUT-001: Investigation list 返回 facets 并分层渲染近期窗口

Tests:
- `test:9c5802a66bc659ebcf985c6195ba4103400148f7f77da79464929b8e8efe328c`

Tags:
- `investigation-report`

Contract:
- Investigation list 从一次索引 snapshot 返回筛选外的全局 facets，默认按 formedAt 倒序取最新 10 条；紧凑 preview 最多显示 30 个 tags 和最近 10 个 UTC 月份，detail 展开完整目录和多行摘要但保持同一 limit 窗口。

Proves:
- 32 条跨月报告的 API 返回默认 10 条近期结果及完整 32 条 facets；紧凑 CLI 从 33 个 tags 和 32 个月份中分别显示 30 个和最近 10 个并报告省略数量及下一 offset，detail 的 limit 1 展开完整目录、title 与 question，offset 越界仍返回 facets、总数和空页上下文，索引字节始终不变。
