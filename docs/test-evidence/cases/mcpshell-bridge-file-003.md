### Case MCPSHELL-BRIDGE-FILE-003: workspace put binds its final commit to the verified parent during a symlink swap

Tests:
- `test:db1e378c3b996fab3e2970b769933189a6c56dd5bab34d3b0352cf1bb036bf30`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在验证 destination parent 的 physical path 后，temporary 与最终 basename commit 必须都绑定到该已验证目录，不能被随后替换的 lexical symlink 重定向到 project root 外。

Proves:
- fake SSH 的 wc seam 先确认已验证 cwd 与 receive 临时文件，提交前同步交换 symlink 且外层 event 命中；链接最终指向外部，但原 parent 保留完整 payload，外部无 destination。
