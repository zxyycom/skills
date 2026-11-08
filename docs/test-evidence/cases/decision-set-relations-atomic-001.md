### Case DECISION-SET-RELATIONS-ATOMIC-001: 多来源关系替换预检和共同提交

Tests:
- `test:2d033f93c248543b7e887279526dea7b766521e53b28c1d4276de8e72e7d79de`

Tags:
- `decision-records`

Contract:
- 多来源关系分组作为单次请求处理；来源选择失败时不得写入其他来源或索引。

Proves:
- 真实 CLI 的第二组 source 不存在时失败，两个正式来源与索引字节保持；同 fixture 两个合法来源一起提交后，索引中两组均保存所选关系。此节点不声称提交中途失败支持全文件回滚。
