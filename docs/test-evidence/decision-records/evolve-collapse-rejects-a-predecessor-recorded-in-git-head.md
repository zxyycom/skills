### Case DECISION-UNRECORDED-COLLAPSE-RECORDED-001: Evolve 折叠拒绝已进入 Git HEAD 的前序
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve collapse rejects a predecessor recorded in Git HEAD`
- `bun test --test-name-pattern="^evolve collapse rejects a predecessor recorded in Git HEAD$" ./tools/decision-records/tests/run.ts`
Contract:
- `--collapse-unrecorded` 只能删除当前 Git HEAD 中不存在同一决策根相对路径的活动已建立前序。
Proves:
- 中间记录路径提交到 Git HEAD 后，折叠返回已记录诊断并拒绝执行。
- 拒绝路径逐字节保留后继候选、中间记录和派生索引。
