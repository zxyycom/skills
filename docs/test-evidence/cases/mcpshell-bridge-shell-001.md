### Case MCPSHELL-BRIDGE-SHELL-001: workspace shell preserves multiline data until the fixed target shell consumes it

Tests:
- `test:d7d374a322074bfccbc00a78e389ce4e2053528edda5ff1055a5d4c378086b10`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 完整 command 只能经 SSH stdin 在固定目标 shell 消费一次。

Proves:
- quotes、newline、here-doc、dollar 和 backticks 产生预期 stdout，不经本地或 remote command 字符串二次解释。
