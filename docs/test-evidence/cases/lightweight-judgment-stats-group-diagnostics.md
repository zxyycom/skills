### Case LIGHTWEIGHT-JUDGMENT-STATS-GROUP-DIAGNOSTICS-001: 标签分组参数诊断

Tests:
- `test:a787a2b832cc76131863ee0d031cf880b6cd8a5ee7075a55f7794aaaeb46f5e4`

Tags:
- `lightweight-judgment`

Contract:
- 非法 tag:<key> 分组在读取数据库前拒绝；诊断定位 --group-by 与标签键规则，不要求筛选参数的 key=value 或键唯一性。

Proves:
- 空键、空白、等号、超长与数字起始键均 input／退出2；stdout 与 stderr 均明确 --group-by、tag:<key> 及键模式，无 key=value 或唯一性要求，attempts为0且无结果或 persistence。
