### Case DECISION-RELATION-QUERY-OPTIONS-001: 关系查询选项拒绝重复出现

Tests:
- `test:c3bf5203bcead71dcd257300c94c0ce58181b92116e4434ef016e4e043aeb284`

Tags:
- `decision-records`

Contract:
- `list` 与 `search` 的单值 `--related-to`、`--direction`、`--relation-type` 各自至多出现一次，不能由后一个值静默覆盖前一个值。

Proves:
- 两个命令对三种关系查询选项的每一种重复出现均以参数错误码 `2` 退出，不写 stdout，并指出重复的选项。
