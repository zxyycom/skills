### Case MCPSHELL-BRIDGE-SHELL-001: workspace shell preserves multiline data until the fixed target shell consumes it

Tests:
- `test:3b786b60e9def3d38c96b555e8913d2815942841e833d44bdff64fcc7cd9ed8c`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 完整 command 只能经 SSH stdin 在固定目标 shell 消费一次。

Proves:
- quotes、newline、here-doc、dollar 和 backticks 产生预期 stdout，不经本地或 remote command 字符串二次解释。
