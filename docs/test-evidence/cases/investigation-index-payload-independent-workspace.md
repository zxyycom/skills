### Case IR-INDEX-PAYLOAD-WORKSPACE-RECHECK-001: index独立写前重读工作区索引

Tests:
- `test:afcb713e95c7d33613aa7f6771a6ae407ddfc8cba950a420117234ea2d9d63ae`

Tags:
- `investigation-report`

Contract:
- IR index准备阶段事实不能代替写前对可变工作区发布索引的独立读取、解析与比较。

Proves:
- 初始读取后改变工作区索引时，stage返回source-drift且pending不变。
