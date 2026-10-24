### Case DECISION-TRANSACTION-UNCHANGED-FRESH-001: Unchanged 仍独立验证所选来源

Tests:
- `test:da4f40f51705de7ab8633f7289ed833fec4caa8aa6c228bc22454c6b2f549f35`

Tags:
- `decision-records`

Contract:
- unchanged 不能跳过所选来源和索引的 fresh/CAS 保护，也不能扩大为全集正文门禁。

Proves:
- 请求无关系变化，在来源快照与独立 fresh 之间实际编辑所选正文后返回 no-change；保留后来编辑与原索引。
