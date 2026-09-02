### Case INVESTIGATION-CANDIDATE-DISCARD-006: candidate discard rechecks Git HEAD before deletion

Entry:

- `tools/investigation-report/tests/publish.test.ts > candidate discard rechecks Git HEAD immediately before deletion`
- `bun test --test-name-pattern="^candidate discard rechecks Git HEAD immediately before deletion$" ./tools/investigation-report/tests/run.ts`

Contract:

- `discard-candidate` 在 tombstone 移动前重新核对 candidate 与 owner resource 的 Git HEAD 记录；新进入 HEAD 的内容仍需 `--delete-recorded-candidate` 明确确认。

Proves:

- 初次检查后、删除前进入 HEAD 的 candidate 会停止事务并要求确认。
- candidate 文件未被移动或删除。
