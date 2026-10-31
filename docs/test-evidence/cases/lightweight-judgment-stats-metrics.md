### Case LIGHTWEIGHT-JUDGMENT-STATS-METRICS-001: 分位数缺失与桶边界

Tests:
- `test:e67540ed165d14e1aee23b0fb42c8f8d9d5ea4cd286513ad1315173ba3d0d1fb`

Tags:
- `lightweight-judgment`

Contract:
- 请求级统计使用明确 nearest-rank 分位数，NULL 与零分别计数，分桶下界含／上界不含，空 cohort 合法。

Proves:
- 已知 fixture 的 elapsed P50/P100 为300/1000，双题请求 tokens 只累计30；零值和缺失分列，边界样本逐桶计数，空集 sum／分位数为null。
