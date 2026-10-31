### Case DECISION-NATIVE-BUILD-RELATIONS-001: 原生构建后验证完整领域关系图

Tests:
- `test:7f8de6b4921f9dd955de05d988a37bba4bf9a2c2be56635d977a23f7b9a68ed9`

Tags:
- `decision-records`

Contract:
- Decision 索引构建必须验证完整领域关系图，拒绝不存在的 target 和自环。

Proves:
- native 结构合法但 target 缺失或后序 entry 自环时，构建返回 decision-index.relation-invalid、decision-index.json 路径与具体关系原因，不返回成功索引。
