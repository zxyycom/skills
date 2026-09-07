### Case MCPSHELL-BRIDGE-SHELL-001: workspace shell preserves multiline data until the fixed target shell consumes it

Tests:
- `test:3778b3a90aba5849a4a75c6d5528cda2b1bb3118a1f57c339fc038565d4fd9fc`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 完整 command 只能经 SSH stdin 在固定目标 shell 消费一次。

Proves:
- quotes、newline、here-doc、dollar 和 backticks 产生预期 stdout，不经本地或 remote command 字符串二次解释。
