### Case NOVEL-CARDS-SNAPSHOT-CONTEXT-028: 快照引用语境

Tests:
- `test:b268060320700afadd08f189137fef717e3fe69a36c443e5b6c16511dca95bd2`

Tags:
- `novel-cards`

Contract:
- 完整旧原文不自动伪造历史引用；快照普通ID语境必须机器可辨，未锁版本children不能当历史闭包。

Proves:
- show旧summary输出snapshot-unqualified-current-not-historical；expand同快照失败并定位无法证明的历史闭包。
