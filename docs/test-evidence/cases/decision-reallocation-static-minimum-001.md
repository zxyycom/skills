### Case DECISION-REALLOCATION-STATIC-MINIMUM-001: 严格关系检查拒绝规模不足的重划分量

Tests:
- `test:677a88d3a5c24c4912d9a01ecdeff27e1e17558b9c3ad3ace87c0f7746879417`

Tags:
- `decision-records`

Contract:
- 已建立关系图中的每个重划分量都至少有两个直接前序和两个直接后继。

Proves:
- 真实内存 Markdown 解析及领域图校验对单条已建立重划边返回后继数量不足诊断。
