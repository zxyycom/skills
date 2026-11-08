### Case INVESTIGATION-INDEX-QUERY-001: 调查列表时间顺序与 tag 筛选

Tests:
- `test:8f7d4e88a44f15b8b43b3150b2746fd965c22ba80c1d50679402762dcf9fe1ad`

Tags:
- `investigation-report`

Contract:
- 列表按 formedAt 倒序，tag 筛选不改变全量 facets。

Proves:
- 固定快照中较新的报告排在第一；按 blue tag 只返回匹配报告且全量 record_count 仍为二。
