### Case DECISION-REALLOCATION-TRANSACTION-001: Evolve 建立闭合稀疏重划并独立对齐后继

Tests:
- `test:c6788e587681ba075a671fe361dc2de79d1d38a6838616fc4c48ecc7606c5785`

Tags:
- `decision-records`

Contract:
- `evolve` 必须用候选各自声明的连通稀疏重划关系，同时归档多个活动前序，并分别建立和确认全部后继。

Proves:
- 一个后继承接两个前序、另一个只承接其中一个前序时，两个前序都归档且关系保持稀疏。
- 两个后继分别保存 aligned 与 unaligned，最终严格关系检查通过。
