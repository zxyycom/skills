### Case LIGHTWEIGHT-JUDGMENT-STATS-PARTIAL-001: 缺失未完成与被筛掉首条

Tests:
- `test:b4e8327e37e830e46db4eb7275df7b6ca193d3c5eb762069434157be3731ad62`

Tags:
- `lightweight-judgment`

Contract:
- 缺首条、首条未完成及首条被时间／模型筛掉分别报告，不把所选最早调用改为 index1，部分批次可辨别。

Proves:
- 三个批次 firstState 分别 filtered/missing/unfinished；filtered 原库两条且 partial true、first null，comparable0；独立时间／型号筛选均不重标首条，跨批缺失／后续覆盖正确。
