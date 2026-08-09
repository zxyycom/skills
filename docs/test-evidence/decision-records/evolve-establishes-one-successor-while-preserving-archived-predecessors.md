### Case DECISION-EVOLVE-COMMAND-001: Evolve 建立单后继并保留已归档前序
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve establishes one successor while preserving archived predecessors`
- `bun test --test-name-pattern="^evolve establishes one successor while preserving archived predecessors$" ./tools/decision-records/tests/run.ts`
Contract:
- 单后继 evolve 可以使用活动和已归档的合法直接前序；事务只归档新增活动前序，并保存调用方提供的完整最终关系集合。
Proves:
- 活动前序在事务后成为 archived，原本已归档的前序继续保持 archived。
- 新后继成为已建立记录，并按输入顺序保存同时指向两类前序的完整关系。
