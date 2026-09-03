### Case MCPSHELL-BRIDGE-SHELL-001: workspace shell preserves multiline data until the fixed target shell consumes it

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace shell preserves multiline data until the fixed target shell consumes it`
- `bun test --test-name-pattern="^workspace shell preserves multiline data until the fixed target shell consumes it$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 完整 command 只能经 SSH stdin 在固定目标 shell 消费一次。

Proves:
- quotes、newline、here-doc、dollar 和 backticks 产生预期 stdout，不经本地或 remote command 字符串二次解释。
