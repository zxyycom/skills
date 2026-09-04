### Case INVESTIGATION-RENAME-HISTORY-001: recorded report 与 candidate 使用各自确认 flag

Entry:
- `tools/investigation-report/tests/rename.test.ts > Investigation rename requires its recorded report or candidate confirmation without rewriting Git history`
- `bun test --test-name-pattern="^Investigation rename requires its recorded report or candidate confirmation without rewriting Git history$" ./tools/investigation-report/tests/run.ts`

Contract:
- 已进入 Git HEAD 的 formal report 与 candidate rename 分别要求 `--rename-recorded-report` 或 `--rename-recorded-candidate`，确认只适用于当前工作树。

Proves:
- 无 flag 的 formal 和 candidate rename 分别返回对应 attention。
- 使用对应 flag 后两种 rename 都成功。
