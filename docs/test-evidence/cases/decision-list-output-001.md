### Case DECISION-LIST-OUTPUT-001: Decision CLI 分层渲染紧凑与 detail 列表

Tests:
- `test:e95ce24d68e770d2dea6be9fd5522474fdbfade432ac2d4c98eb17832183e0e6`

Tags:
- `decision-records`

Contract:
- 默认 list 显示全局 Index filters、Applied filters、最多 30 个 tags、最近 10 个 UTC 月份、窗口内紧凑定位行和剩余范围；detail 在同一 limit 窗口恢复完整 facet 目录与原有多行摘要，不读取 Markdown 或改写索引。

Proves:
- 34 条记录形成 35 个 tags 和 32 个 UTC 月份；紧凑输出只显示排序后的 30 个 tags 与 10 个月份并报告省略数量。limit 1 省略 sourcePath 多行字段并报告 next offset；detail 输出完整目录、sourcePath 与 purpose；offset 越界保留全局 facets、匹配总数和空页上下文，三个调用前后的索引字节一致。
