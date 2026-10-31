### Case INVESTIGATION-LAZY-SNAPSHOT-001: 同一快照的校验筛选与追踪共用一张图

Tests:
- `test:b8654ddf8053bad7323baec224380c6ad14ef63b91fadbaef317b9095837987c`

Tags:
- `investigation-report`

Contract:
- 同一不可变投影内的完整图校验、type-only/目标筛选与 trace 共用首次按需构建的关系图，不改写输入。

Proves:
- 完整校验、type-only/双向筛选与 trace 返回准确成员及摘要，连续读取图引用相同，输入 entries 的 JSON 字节表示不变。
