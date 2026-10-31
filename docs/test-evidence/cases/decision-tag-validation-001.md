### Case DECISION-TAG-VALIDATION-001: 标签必需、有序且唯一

Tests:
- `test:0b4a8633be179593d89423e72ac7f1b1c6de1e6d41287f3760930a733f5f6e2d`

Tags:
- `decision-records`

Contract:
- 每条决策 tags 非空、合法、词法有序且唯一。

Proves:
- 在 ID 匹配的合法正文中，缺失、空、非法、逆序、重复 tags 分别触发对应 tags 专属诊断。
