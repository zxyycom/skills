### Case MCPSHELL-BRIDGE-RUNTIME-002: workspace caps captured output and cleans an output-limited get receive

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace caps captured output and cleans an output-limited get receive`
- `bun test --test-name-pattern="^workspace caps captured output and cleans an output-limited get receive$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 嵌入 JSON envelope 的 stdout/stderr 各最多 capture 1 MiB；任一 stream 超限必须终止 SSH process group、以 `output_limit` 优先返回有界前缀和 stream/limit evidence。get 的 stderr 超限时必须删除 local receive temporary。

Proves:
- shell 的 stdout 与 stderr 分别超限时均返回 `output_limit`、null target exit、false timed_out 和对应 stream/limit evidence，文本前缀不超过 1 MiB；隔离 SSH 的 get stderr 超限后 destination 与 temporary 都不存在。
