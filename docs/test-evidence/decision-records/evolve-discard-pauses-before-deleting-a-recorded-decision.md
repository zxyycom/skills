### Case DECISION-EVOLVE-DISCARD-RECORDED-001: Evolve discard 在删除已记录决策前暂停
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve discard pauses before deleting a recorded decision`
- `bun test --test-name-pattern="^evolve discard pauses before deleting a recorded decision$" ./tools/decision-records/tests/run.ts`
Contract:
- `evolve --discard` 删除已进入 Git `HEAD` 的 Decision ID 时，未带 `--delete-recorded-decision` 必须 attention 且零写入。
Proves:
- 后继候选、删除目标和派生索引在 attention 后保持不变。
