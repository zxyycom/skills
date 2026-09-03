### Case MCPSHELL-BRIDGE-INTEGRATION-001: MCPShell stdio exposes the generated fixed-root tools and one read-only shell call

Entry:
- `tools/mcpshell-workspace-bridge/tests/mcpshell-integration.test.ts > MCPShell stdio exposes the generated fixed-root tools and one read-only shell call`
- `MCPSHELL_BIN=<existing-mcpshell-binary> bun test --test-name-pattern="^MCPShell stdio exposes the generated fixed-root tools and one read-only shell call$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 真实 MCPShell binary 必须能 validate 分发 YAML，以 stdio MCP 完成 initialize/initialized 和 tools/list，并只用隔离 SSH fixture 在固定 target root 调用一次只读 `workspace_shell`；缺少显式 binary 时该原生入口跳过，测试不下载或安装依赖。

Proves:
- tools/list 的准确四项名称集合和参数 schema 与生成 YAML 的 shell、patch、put/get 契约一致，且没有暴露 backend 或 project root。
- 一次 shell call 返回成功 JSON envelope 和 target root 中的预期 stdout，随后 server 因 stdin 正常关闭而退出，临时 agent/target/staging root 被清理。
