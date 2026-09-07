### Case DECISION-INDEX-DEFINITION-001: 索引拒绝旧 definitionVersion

Tests:
- `test:cf8b33acb8592f614444d334118993a995ac5e0531305a8234bbb3070ca00df8`

Tags:
- `decision-records`

Contract:
- 当前 ID 键索引只接受 definitionVersion 6，不能兼容 version 5。

Proves:
- parser 返回 error，写入 version 5 后 strict check 非零并报告版本诊断。
