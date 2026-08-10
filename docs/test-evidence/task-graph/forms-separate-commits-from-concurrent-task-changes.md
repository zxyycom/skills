### Case TASK-GRAPH-STAGE-COMMITS-001: 并发 task 变化可形成独立提交

Entry:
- `tools/task-graph/tests/staging.test.ts > forms separate commits from concurrent task changes without modifying the workspace index`
- `bun test --test-name-pattern="^forms separate commits from concurrent task changes without modifying the workspace index$" ./tools/task-graph/tests/run.ts`

Contract:
- 同一中央索引中的多个 task 变化可以依次按 ID 构造 pending 并分别提交，分段命令不改写完整工作区候选。

Proves:
- 第一个真实 Git commit 只包含第一个 task 的候选条目，第二个 commit 再加入第二个 task。
- 两次暂存之间工作区始终保留完整候选；第二次提交后 HEAD 等于候选且工作区无剩余差异。
