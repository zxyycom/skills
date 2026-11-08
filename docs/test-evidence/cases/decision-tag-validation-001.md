### Case DECISION-TAG-VALIDATION-001: 标签必需、有序且唯一

Tests:
- `test:f849833056c7db08c851f0024c5fae21afe226dda6e8bb519f8db436c4c594d1`

Tags:
- `decision-records`

Contract:
- 每条决策 tags 非空、合法、词法有序且唯一。

Proves:
- 原生 frontmatter parser 分别拒绝缺失、空、非法、逆序与重复 tags；节点不断言旧 TS 专属诊断文本。
