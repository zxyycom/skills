### Case INVESTIGATION-CLI-CONTRACTS-001: CLI check succeeds on a current report collection

Tests:
- `test:cbc90da6c46d85f0447aa06ef5d2d35d47447bd6b1b1ddeab7bd9483690d0328`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `check` 能成功验证当前完整报告集合。

Proves:
- 合法集合以退出码 0 成功、stderr 为空，并在 stdout 报告完整 index 计数。
