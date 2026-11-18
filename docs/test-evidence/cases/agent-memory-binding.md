### Case AGENT-MEMORY-BINDING-001: 项目绑定和查询不建库

Tests:
- `test:9d1a529e3d299f16e8c4f66da2dc390ed3222d5b822a62d1c3ae80d32b433898`

Tags:
- `agent-memory`

Contract:
- 记忆库只接受绑定的工作区目录；查询不建库，初始化不能覆盖既有库。

Proves:
- 同一个库不允许其他项目根读写或覆盖初始化，原信息仍在。
- 缺库召回、项目树内建库、文件作为项目根及无效初始化输入均不创建数据库；正确绑定的空召回成功。
