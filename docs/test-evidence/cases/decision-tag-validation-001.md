### Case DECISION-TAG-VALIDATION-001: 标签必需、有序且唯一

Tests:
- `test:ffd9039bd7b925232f0935516de08aa07d2204a7eff2d4998b3b358b221d3724`

Tags:
- `decision-records`

Contract:
- 每条决策 tags 非空、合法、词法有序且唯一。

Proves:
- 缺失、空、非法、逆序、重复 tags 分别被正文验证拒绝。
