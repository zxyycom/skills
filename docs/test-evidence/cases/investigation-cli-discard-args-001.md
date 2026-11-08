### Case INVESTIGATION-CLI-DISCARD-ARGS-001: discard 拒绝路径式 selector

Tests:
- `test:93f1b9ae68c701fc2e8d337dcb58b27c2cd3997ff0081bd2e8ed67755ab27f1a`

Tags:
- `investigation-report`

Contract:
- discard 不把路径式输入当作可删除的报告身份。

Proves:
- 已有合法候选时，真实 CLI 以 ../outside 调用返回 selector 错误且退出 1，已有候选字节与目录项保持。
