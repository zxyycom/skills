### Case DECISION-EVOLVE-DISCARD-RECORDED-FLAG-001: Evolve discard 参数删除已记录决策而不读取 Git HEAD
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve discard flag deletes a recorded decision without reading Git HEAD`
- `bun test --test-name-pattern="^evolve discard flag deletes a recorded decision without reading Git HEAD$" ./tools/decision-records/tests/run.ts`
Contract:
- `evolve --discard` 带 `--delete-recorded-decision` 时，该参数是删除目标的机械确认，不为 discard 自身重复读取 Git `HEAD`。
Proves:
- 删除目标已进入 Git HEAD 且 HEAD 随后不可读取时，来源关系为空的新 candidate 仍在同一事务建立，目标被删除。
