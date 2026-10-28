### Case DECISION-REALLOCATION-CLOSURE-002: 重划闭包保留首分量诊断

Tests:
- `test:f32b4ba98756b70e99e4984a18e4107e2f69fa5159dde5e8cebc082dd5f63ac6`

Tags:
- `decision-records`

Contract:
- 重划闭包按原顺序选取首个包含所选后继的分量，并要求选择与该分量一致。

Proves:
- 两个分量各命中一个后继时，遗漏及分量外成员诊断来自首个分量；分量大于选择时仍给出正确遗漏成员。
