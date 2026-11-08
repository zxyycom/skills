### Case INVESTIGATION-LIST-FACETS-001: 列表 facets 保持完整快照计数

Tests:
- `test:8f7d4e88a44f15b8b43b3150b2746fd965c22ba80c1d50679402762dcf9fe1ad`
- `test:8fc38b0078d1ddfea1f7f8b68c272611f888965e27c46498c028dd1fe1023fad`

Tags:
- `investigation-report`

Contract:
- Investigation list 的 facets 基于完整索引快照而非过滤结果，时间按 UTC 月份统计且每条记录的相同 tag 只计一次。

Proves:
- 两条记录中按 tag 过滤仅返回一条，facets.record_count 仍为二。
- 共享 facets 计算将跨月时区时间归入 UTC 月份，重复 tag 计一次并拒绝非法时间。
