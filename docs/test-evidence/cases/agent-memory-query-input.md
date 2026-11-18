### Case AGENT-MEMORY-QUERY-INPUT-001: 查询输入错误不是查询结果

Tests:
- `test:1bacafd8afc7f6081fd8334ecb49a33a062024d409b4287d11155367fac3b303`

Tags:
- `agent-memory`

Contract:
- 查询拒绝无效 JSON 和未声明的字段，不用默认查询掩盖输入错误。

Proves:
- 版本或限制字段拼错、JSON 不完整时，命令失败且 stdout 为空；诊断说明原因，但不原样输出未知键。
