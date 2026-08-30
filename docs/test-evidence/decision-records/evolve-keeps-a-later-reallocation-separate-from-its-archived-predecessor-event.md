### Case DECISION-REALLOCATION-HISTORY-BOUNDARY-001: Evolve 区分先后重划事件

Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve keeps a later reallocation separate from its archived predecessor event`
- `bun test --test-name-pattern="^evolve keeps a later reallocation separate from its archived predecessor event$" ./tools/decision-records/tests/run.ts`

Contract:
- 后续重划已归档的早先后继时，闭合计算必须区分同一 Decision ID 在早先事件中的后继角色和后来事件中的前序角色。

Proves:
- 新的两个后继可以围绕旧后继和另一前序建立完整连通分量，不会被要求同时选择早先事件的其他后继。
- 合并后的已建立关系图通过严格检查。
