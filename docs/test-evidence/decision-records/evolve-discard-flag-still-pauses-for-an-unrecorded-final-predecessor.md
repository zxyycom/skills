### Case DECISION-EVOLVE-DISCARD-RELATION-HISTORY-001: Evolve discard 参数不绕过最终关系的历史确认
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve discard flag still pauses for an unrecorded final predecessor`
- `bun test --test-name-pattern="^evolve discard flag still pauses for an unrecorded final predecessor$" ./tools/decision-records/tests/run.ts`
Contract:
- `--delete-recorded-decision` 只确认删除目标；最终关系指向尚未进入 Git HEAD 的已建立前序时，仍须以 `--keep-unrecorded-history` 明确保留该独立历史。
Proves:
- CLI 返回前序历史 attention，且后继、删除目标、前序 Markdown 与索引均保持不变。
