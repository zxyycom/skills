### Case DECISION-ESTABLISHED-ALIGNMENT-001: 已建立记录要求明确对齐状态

Tests:
- `test:e7e8b21d1b3201c18ce9be8d468150cae928e6407dfe21cfe8a2676cdc9e7e5c`
- `test:f170cc3c6998073079ae0ce4a90ca9812723b30b9178b72501a41888dc905471`

Tags:
- `decision-records`

Contract:
- active 与 archived 来源只能使用 aligned 或 unaligned；candidate 的 null 模型不属于已建立状态。

Proves:
- Frontmatter 解析接受两种已建立生命周期与两个非空 alignment 的全部组合，拒绝每种生命周期的 null 与缺失字段。
- 内存来源构建快照保留合法非空值，并在 null 或缺失的已建立来源进入索引前失败。
