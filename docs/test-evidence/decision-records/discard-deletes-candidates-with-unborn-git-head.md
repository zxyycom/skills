### Case DECISION-CANDIDATE-DISCARD-UNBORN-001: Discard 删除 unborn Git HEAD 工作树中的候选
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discard deletes candidates in a Git worktree with unborn HEAD`
- `bun test --test-name-pattern="^discard deletes candidates in a Git worktree with unborn HEAD$" ./tools/decision-records/tests/run.ts`
Contract:
- 尚无首次提交的 Git 工作树没有已记录 Decision ID；完整且未被引用的 candidate 可由普通 `discard` 删除。
Proves:
- 初始化但未提交的 Git 工作树中，普通 discard 成功删除 candidate 文件。
