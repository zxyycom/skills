### Case DECISION-SET-RELATIONS-REPLACE-001: set-relations 完整替换已建立记录关系并重建索引

Tests:
- `test:bbbef6bec221c129065217e6601a26d96036fadc60e22c685e8ae6c4796d4e9f`
- `test:f8264139cd816e115baaf81969b5f1e6098c8a23af887c6c0057554b428f4799`

Tags:
- `decision-records`

Contract:
- `set-relations` 按 `--source` 分组完整替换已建立记录的直接关系，并在同一事务重建派生索引；完整替换不合并旧关系或旧摘要。

Proves:
- 共享关系规划用新 target 完整替换旧 target，未分组来源保留原关系；该节点不运行文件事务。
- 原生 Decision 事务写入关系并读回索引及正文中的 target/摘要；再次替换为无摘要后，索引和正文都不再保留旧摘要。
- 两节点组合覆盖共享替换语义与领域持久化接线，不声称文件事务节点自身验证了旧 target 到新 target 的替换。
