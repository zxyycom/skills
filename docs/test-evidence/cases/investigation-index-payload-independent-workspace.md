### Case IR-INDEX-PAYLOAD-WORKSPACE-RECHECK-001: index独立写前重读工作区索引

Tests:
- `test:4cc33c6c2056edf26dcb69588f92639912daeae7f92f80074f63a9a35793cc83`

Tags:
- `investigation-report`

Contract:
- IR index准备阶段事实不能代替写前对可变工作区发布索引的独立读取、解析与比较。

Proves:
- 初始读取后改变工作区索引时，stage返回source-drift且pending不变。
