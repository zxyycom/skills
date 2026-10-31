### Case LIGHTWEIGHT-JUDGMENT-STATS-GROUP-DIAGNOSTICS-001: 标签分组参数诊断

Tests:
- `test:ad2b4bc01f10bde4d475e9be6085578c7142f018e14eec316e1f17357fa87b47`

Tags:
- `lightweight-judgment`

Contract:
- 非法 tag:<key> 分组应返回输入诊断，优先于缺库 storage 诊断；定位 --group-by 与键规则。

Proves:
- 空键、空白、等号、超长与数字起始键均返回 input/退出2，stdout/stderr 明确 group-by 与 tag:<key>，无错误 key=value/唯一性要求，attempts=0；观察范围为返回诊断及退出结果。
