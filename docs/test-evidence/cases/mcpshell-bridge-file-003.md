### Case MCPSHELL-BRIDGE-FILE-003: workspace put binds its final commit to the verified parent during a symlink swap

Tests:
- `test:db1e378c3b996fab3e2970b769933189a6c56dd5bab34d3b0352cf1bb036bf30`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在验证 destination parent 的 physical path 后，temporary 与最终 basename commit 必须都绑定到该已验证目录，不能被随后替换的 lexical symlink 重定向到 project root 外。

Proves:
- fixture 在 remote temporary 出现后把 project 内 symlink 换到 project 外目录；传输仍只写入原已验证 parent，外部目录没有 destination。
