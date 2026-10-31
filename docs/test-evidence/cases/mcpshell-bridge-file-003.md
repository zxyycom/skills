### Case MCPSHELL-BRIDGE-FILE-003: workspace put binds its final commit to the verified parent during a symlink swap

Tests:
- `test:5aefaf32e3d6fda3f3b7df9638ed9aeb6109b048b1c891b7109022c535389008`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在验证 destination parent 的 physical path 后，temporary 与最终 basename commit 必须都绑定到该已验证目录，不能被随后替换的 lexical symlink 重定向到 project root 外。

Proves:
- fake SSH 的 wc seam 先确认已验证 cwd 与 receive 临时文件，提交前同步交换 symlink 且外层 event 命中；链接最终指向外部，但原 parent 保留完整 payload，外部无 destination。
