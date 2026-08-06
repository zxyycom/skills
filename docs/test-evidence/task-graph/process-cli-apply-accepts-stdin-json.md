### Case TASK-GRAPH-CLI-STDIN-001: apply 从 stdin 接收单个 JSON request

Entry:
- `tools/task-graph/tests/cli.test.ts > process CLI apply accepts a JSON request from stdin without extra output`
- `bun test --test-name-pattern="^process CLI apply accepts a JSON request from stdin without extra output$" ./tools/task-graph/tests/run.ts`

Contract:
- apply 在未指定 file 时从 stdin 读取完整 JSON request，并保持 JSON-only 进程协议。

Proves:
- stdin 批次成功提交并返回 alias 映射，stdout 只有一个 LF JSON 且 stderr 为空。
