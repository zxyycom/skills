### Case GATE-METRICS-BLOCKING-001: 生产指标使用 blocking 政策与随包函数分析器

Tests:
- `test:f1fa9415398c0eee4ef2df0e2094488aa41908cf26d1a11bb19f22561ea3eb51`

Tags:
- `repository-tooling`

Contract:
- 生产文件与函数指标的 code area 必须采用 blocking 政策且不配置 waiver；函数指标使用随包分析器，不声明外部 scanner。

Proves:
- 生产 file/function Check 的全部 code area 都配置 blocking policy，两项 findingWaivers 均为空数组。
- function-metrics 的生产 options 不含 scanner 字段。
