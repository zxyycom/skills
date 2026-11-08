### Case DECISION-ACTIVATE-RELATION-CLEAR-001: Evolve 显式清空候选来源关系

Tests:
- `test:450da961340dd6df4f158bbc10af582ceee2ee87efe57ae661b47a036f93a2d0`

Tags:
- `decision-records`

Contract:
- 显式清空关系表示将候选最终关系替换为空，而非保留来源关系。

Proves:
- 原生 evolve 操作的候选来源含指向待删除旧记录的关系；预检拒绝后显式空覆盖并提交，索引中已建立后继关系为空。该节点不验证 CLI 参数或 review 渲染。
