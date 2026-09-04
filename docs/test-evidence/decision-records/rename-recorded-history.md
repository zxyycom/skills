### Case DECISION-RENAME-HISTORY-001: 已记录 Decision 需要 rename 专属确认

Entry:
- `tools/decision-records/tests/rename.test.ts > Decision rename requires recorded-history confirmation without changing the source`
- `bun test --test-name-pattern="^Decision rename requires recorded-history confirmation without changing the source$" ./tools/decision-records/tests/run.ts`

Contract:
- 进入 Git HEAD 的 Decision identity 仅可由 `--rename-recorded-decision` 明确确认当前工作树 rename，且不重写历史。

Proves:
- 缺少确认时 CLI 返回 rename 专属 flag 提示且 source 不变。
- 带确认 flag 的同一 rename 成功。
