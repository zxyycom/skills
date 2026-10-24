### Case DECISION-NATIVE-BUILD-RELATIONS-001: 原生构建后验证完整领域关系图

Tests:
- `test:4d86d2c5118095357576e5a5a3ec1a7627aa9e55daa990220d85670c2dabe0a8`

Tags:
- `decision-records`

Contract:
- Decision 索引构建必须验证完整领域关系图，拒绝不存在的 target 和自环。

Proves:
- native 结构合法但 target 缺失或后序 entry 自环时，构建返回 decision-index.relation-invalid、decision-index.json 路径与具体关系原因，不返回成功索引。
