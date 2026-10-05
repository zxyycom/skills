### Case LIGHTWEIGHT-JUDGMENT-CLI-011: Score 完整校验

Tests:
- `test:82c3343eec77b5beed70daaa81dc573e76fa8f3450baf506afed3a5b43b4abd5`

Tags:
- `lightweight-judgment`

Contract:
- Score 的范围、概率键与 legend 须对应请求等级，概率与 confidence 有效；不校验概率归一化或加权一致性。

Proves:
- Score 类型与范围、confidence 范围、概率键与类型及范围、legend 键与字符串等级及值类型各自错误返回 invalid_response；加权不一致与未归一化概率原样通过，不限制为两位小数。
