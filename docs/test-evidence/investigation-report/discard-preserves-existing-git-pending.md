### Case INVESTIGATION-DISCARD-PENDING-001: discard preserves existing Git pending content

Entry:
- `tools/investigation-report/tests/discard.test.ts > discard preserves existing Git pending content`
- `bun test --test-name-pattern="^discard preserves existing Git pending content$" ./tools/investigation-report/tests/run.ts`

Contract:
- discard 只修改工作树，不得改变已有 Git pending 快照。

Proves:
- 删除已记录报告后 cached binary diff 与操作前完全相同。
