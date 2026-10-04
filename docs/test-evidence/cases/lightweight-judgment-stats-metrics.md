### Case LIGHTWEIGHT-JUDGMENT-STATS-METRICS-001: 分位数缺失与桶边界

Tests:
- `test:73041b282bf95a8cd516d3acc02779614a7dec9c135941bc8ad7791139d3449e`

Tags:
- `lightweight-judgment`

Contract:
- 请求级统计使用明确 nearest-rank 分位数，NULL 与零分别计数，分桶下界含／上界不含，空 cohort 合法。

Proves:
- 已知 fixture 的 elapsed P50/P100 为300/1000，双题请求 tokens 只累计30；零值和缺失分列，边界样本逐桶计数，空集 sum／分位数为null。
