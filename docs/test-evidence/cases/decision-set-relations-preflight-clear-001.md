### Case DECISION-SET-RELATIONS-PREFLIGHT-CLEAR-001: set-relations 预检零写入并区分清空与未变化来源

Tests:
- `test:0acf66749aca8c1ed1586d5b030a02ce2ec903b30c1d67dd8c1ed588cc8f384f`
- `test:1aea3633b419ada40c82157c5b1d44c848a2f71d8f28f23850b4a273502ea581`
- `test:f8264139cd816e115baaf81969b5f1e6098c8a23af887c6c0057554b428f4799`

Tags:
- `decision-records`

Contract:
- 关系预检不写入索引；显式清空不同于保留，原本为空的关系集合应识别为 unchanged。

Proves:
- 共享 mutation 参数解析将 `--clear-relations` 投影为空关系组；共享关系规划对非空来源给出清空替换，对已空来源给出 unchanged。
- 原生 Decision 关系事务预检产生 replace review 且索引字节不变；实际提交后相同关系再次执行报告 unchanged。
- 节点组合未单独验证 Decision CLI 的清空参数到持久化空集合的端到端接线。
