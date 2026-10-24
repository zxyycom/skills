### Case LIGHTWEIGHT-JUDGMENT-STATS-GROUP-DIAGNOSTICS-001: 标签分组参数诊断

Tests:
- `test:456d00a6ad2404bf6886035278246133ab7e4d707a45922bd6b76fd6fe9a3c65`

Tags:
- `lightweight-judgment`

Contract:
- 非法 tag:<key> 分组应返回输入诊断，优先于缺库 storage 诊断；定位 --group-by 与键规则。

Proves:
- 空键、空白、等号、超长与数字起始键均返回 input/退出2，stdout/stderr 明确 group-by 与 tag:<key>，无错误 key=value/唯一性要求，attempts=0；不将诊断优先级称为直接 DB open 计数。
