### Case RECORD-COST-CASE-004: 版本基线短路

Tests:
- `test:8384b662abcc8937d510df374a83f5b80a031c6df78f510dfd51f12d584eb6db`

Tags:
- `record-cost`

Contract:
- 已发现版本承载变化后无需消费后续损坏对象。

Proves:
- 真实 Git 损坏后项仍允许先前变化产生版本结果。
