### Case DECISION-ESTABLISHED-ALIGNMENT-001: 已建立记录要求明确对齐状态

Tests:
- `test:63837722c63d669adb21e8e110ea9639f8dd161bc7ea7b9f9fdaac55674fef39`
- `test:be5e28b920325ad9d45e7e75e6fec4d6466fb700cb0bde5d1aafaf5c6b2c4078`

Tags:
- `decision-records`

Contract:
- active 与 archived 来源只能使用 aligned 或 unaligned；candidate 的 null 模型不属于已建立状态。

Proves:
- Frontmatter 解析接受两种已建立生命周期与两个非空 alignment 的全部组合，拒绝每种生命周期的 null 与缺失字段。
- 内存来源构建快照保留合法非空值，并在 null 或缺失的已建立来源进入索引前失败。
