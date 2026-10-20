### Case DECISION-LIST-ALIGNMENT-001: List 按 alignment 筛选

Tests:
- `test:6e06242d2d4145f4257af96059feec9d4187d1edaa0f5cfdc9cbfe6ba5cdf570`

Tags:
- `decision-records`

Contract:
- alignment 选择器必须从持久索引返回对应状态。

Proves:
- 真实 list 准备、内存快照投影及 renderer 对 unaligned 条件仅输出 unaligned 活动记录。
