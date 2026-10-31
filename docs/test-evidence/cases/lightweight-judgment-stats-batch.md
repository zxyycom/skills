### Case LIGHTWEIGHT-JUDGMENT-STATS-BATCH-001: 明确首条与后续 P50 对照

Tests:
- `test:bd8b873325ed62dafff9e97ca726db1b9bdabfaf6daf6e19f4d5d51dbce2b9d2`

Tags:
- `lightweight-judgment`

Contract:
- 批次首条仅为调用方提供 index1；后续基线是 nearest-rank P50，不以时间最早或偶数均值替代。

Proves:
- 时间较晚的 index1 被正确选择，后续 [300,1000] 的 P50=300，差值600／倍数3；无批次调用排除对照、跨批分布与分母明确。
