### Case LIGHTWEIGHT-JUDGMENT-CLI-010: Choice 完整校验

Tests:
- `test:ac43a9b4ec52e24e4245772ad60b93c1ead77924f61cb96ab5c39d7105167951`

Tags:
- `lightweight-judgment`

Contract:
- Choice 须满足候选对应、概率键集合与数值范围、confidence 范围要求，不校验概率归一化或最大候选。

Proves:
- 非候选 choice、错误概率键或类型、越界概率与 confidence、confidence 缺失返回 invalid_response；非最大选项、并列项与未归一化概率原样通过。
