### Case AGENT-MEMORY-BINDING-001: 项目绑定和查询不建库

Tests:
- `test:9d1a529e3d299f16e8c4f66da2dc390ed3222d5b822a62d1c3ae80d32b433898`

Tags:
- `agent-memory`

Contract:
- 记忆库只接受绑定的工作区目录；查询不建库，初始化不能覆盖既有库。

Proves:
- 两个隔离库不能互换项目根；错库读写失败并给出诊断，原信息仍在。
- 缺库召回、用文件当作项目根初始化和初始化输入夹带未知字段均不产生数据库，正确绑定的空召回成功。
