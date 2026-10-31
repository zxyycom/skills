### Case DECISION-TRANSACTION-UNCHANGED-FRESH-001: Unchanged 仍独立验证所选来源

Tests:
- `test:2d591f517f4bf67508058a893fe424072f40e9393b8d656dc999a087871cffd6`

Tags:
- `decision-records`

Contract:
- unchanged 不能跳过所选来源和索引的 fresh/CAS 保护，也不能扩大为全集正文门禁。

Proves:
- 请求无关系变化，在来源快照与独立 fresh 之间实际编辑所选正文后返回 no-change；保留后来编辑与原索引。
