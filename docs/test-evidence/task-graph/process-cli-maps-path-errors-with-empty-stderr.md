### Case TASK-GRAPH-CLI-PATH-001: 路径失败返回 exit 1、单个 LF JSON 且 stderr 为空

Entry:
- `tools/task-graph/tests/cli.test.ts > process CLI maps path failures to JSON exit one with empty stderr`
- `bun test --test-name-pattern="^process CLI maps path failures to JSON exit one with empty stderr$" ./tools/task-graph/tests/run.ts`

Contract:
- 真实进程中的路径读取失败仍属于协议内错误，不泄漏原始异常到 stderr 或启动级退出码。

Proves:
- 普通文件 root 返回 exit 1、单个 LF JSON 且 stderr 为空，并保留稳定路径错误 code。
