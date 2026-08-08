### Case TASK-GRAPH-CLI-LIST-RENDER-PARITY-001: 默认 CLI 文本直接渲染完整程序化 projection

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI default task list renders the complete programmatic projection`
- `bun test --test-name-pattern="^CLI default task list renders the complete programmatic projection$" ./tools/task-graph/tests/run.ts`

Contract:
- 默认 task list 必须把同一索引和时刻的 `TaskGraphService.listTasks()` 完整 data 直接交给内部 renderer，不能另建删减 projection。

Proves:
- 同一 rich fixture 的程序化 list result 经 renderer 产生的完整文本，与默认 CLI columns 80 输出逐字节相同。
- Fixture 的输出明确包含 inherited parent、dependency needs、control reason 与 RUN MUTEX，避免单 task projection 的空洞等值。
