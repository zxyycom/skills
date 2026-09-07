### Case DECISION-LIST-TAG-AND-001: List 对重复标签采用 AND 筛选

Tests:
- `test:7e7a5492e396819d6d0d935db96a7dfbb8f079649110f1fa3fad13768dce6648`

Tags:
- `decision-records`

Contract:
- 重复 `--tag` 选择器必须取交集，而不是并集。

Proves:
- A、A+B、B 三条记录中，双 tag 仅返回 A+B。
