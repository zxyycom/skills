### Case DECISION-DISCARD-RECORDED-FLAG-001: Discard 参数删除已记录决策而不读取 Git HEAD
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard flag deletes a recorded decision without reading Git HEAD`
- `bun test --test-name-pattern="^discard flag deletes a recorded decision without reading Git HEAD$" ./tools/decision-records/tests/run.ts`
Contract:
- `--delete-recorded-decision` 是删除已记录 Decision ID 的显式机械选择；带该参数时，direct discard 不再读取 Git `HEAD` 重复判定记录状态。
Proves:
- 已提交 candidate 的 Git `HEAD` 引用损坏后，带参数的 discard 仍成功删除目标。
