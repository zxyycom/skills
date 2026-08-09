### Case DECISION-EVOLVE-HISTORICAL-SUCCESSOR-001: Evolve 拒绝无可确认对齐状态的历史归档后继
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects historical archived successors with null alignment`
- `bun test --test-name-pattern="^evolve rejects historical archived successors with null alignment$" ./tools/decision-records/tests/run.ts`
Contract:
- 历史 `archived + alignment: null` 记录没有可供 successor 参数确认的完整对齐状态，不进入普通关系修订路径。
Proves:
- 选择 alignment 为 null 的归档后继时，evolve 失败并报告必须具有非空 alignment。
