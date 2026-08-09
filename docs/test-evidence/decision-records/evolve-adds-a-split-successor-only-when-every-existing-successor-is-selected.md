### Case DECISION-SPLIT-EXTENSION-001: Evolve 选全既有成员后扩充闭合拆分
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve adds a split successor only when every existing successor is selected`
- `bun test --test-name-pattern="^evolve adds a split successor only when every existing successor is selected$" ./tools/decision-records/tests/run.ts`
Contract:
- 已存在闭合拆分时，新增直接后继必须在同一次 evolve 中显式选择全部既有后继和新增候选。
Proves:
- 同时选择两个既有后继和第三个候选后，第三个后继建立并保存指向共同粗前序的拆分关系。
- 扩充后的完整决策集合通过严格检查。
