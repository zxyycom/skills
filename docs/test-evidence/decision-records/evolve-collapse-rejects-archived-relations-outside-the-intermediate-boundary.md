### Case DECISION-UNRECORDED-COLLAPSE-BOUNDARY-001: Evolve 折叠拒绝越过中间决策边界的归档关系
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve collapse rejects archived relations outside the intermediate boundary`
- `bun test --test-name-pattern="^evolve collapse rejects archived relations outside the intermediate boundary$" ./tools/decision-records/tests/run.ts`
Contract:
- 折叠后的已归档关系目标只能来自被折叠记录原有的直接前序，CLI 不跨层推断、合成或接受无关归档关系。
Proves:
- 最终关系引用无关已归档决策时，evolve 报告该目标不是被折叠记录的直接前序。
- 拒绝路径逐字节保留后继候选、中间记录和 decision-index.json。
