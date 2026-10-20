### Case DECISION-INDEX-DEFINITION-001: 索引拒绝旧 definitionVersion

Tests:
- `test:cf8b33acb8592f614444d334118993a995ac5e0531305a8234bbb3070ca00df8`

Tags:
- `decision-records`

Contract:
- 当前索引 parser 与严格 check 都拒绝旧 definitionVersion。

Proves:
- 纯 parser 对旧 definitionVersion 返回 error；真实索引文件写入旧版本后，严格 API check 报告对应版本错误。
