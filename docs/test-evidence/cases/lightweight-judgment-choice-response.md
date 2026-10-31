### Case LIGHTWEIGHT-JUDGMENT-CLI-010: Choice 完整校验

Tests:
- `test:09e179e54cc5c7bd05188787314dac37f3e2c254889b23ce99e436be53ec2413`

Tags:
- `lightweight-judgment`

Contract:
- Choice 须满足候选对应、概率键集合与数值范围、confidence 范围要求，不校验概率归一化或最大候选。

Proves:
- 非候选 choice、错误概率键或类型、越界概率与 confidence、confidence 缺失返回 invalid_response；非最大选项、并列项与未归一化概率原样通过。
