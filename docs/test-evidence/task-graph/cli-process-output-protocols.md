### Case TASK-GRAPH-CLI-PROCESS-PROTOCOL-001: Process CLI 保持已选择的 stdout 协议与退出状态

Entry:
- `tools/task-graph/tests/cli.test.ts > process CLI preserves selected stdout protocol stderr and exit status`
- `bun test --test-name-pattern="^process CLI preserves selected stdout protocol stderr and exit status$" ./tools/task-graph/tests/run.ts`

Contract:
- 真实 Node process wrapper 必须原样传递 in-memory CLI 选择的文本或 JSON stdout、退出状态，并让可预期结果的 stderr 为空。

Proves:
- 默认文本 success 与 JSON command failure 两个代表路径都与内存入口保持相同 stdout、空 stderr 和退出状态。
