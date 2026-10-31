### Case DECISION-INDEX-DEFINITION-001: 索引拒绝旧 definitionVersion

Tests:
- `test:8d1ac61b0aef534e4caf4ec16b42a0dae417e4bada4de00c4043cd0dc3aabc24`

Tags:
- `decision-records`

Contract:
- 当前索引 parser 与严格 check 都拒绝旧 definitionVersion。

Proves:
- 纯 parser 对旧 definitionVersion 返回 error；真实索引文件写入旧版本后，严格 API check 报告对应版本错误。
