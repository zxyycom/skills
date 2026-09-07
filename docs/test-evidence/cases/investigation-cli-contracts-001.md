### Case INVESTIGATION-CLI-CONTRACTS-001: CLI check succeeds on a current report collection

Tests:
- `test:38a331b12e467227e89bcb889d6e21321f30622e92e6a150e6429658eb1e11ca`

Tags:
- `investigation-report`

Contract:
- 直接调用的源码 CLI 入口 `check` 能成功验证当前完整报告集合。

Proves:
- 合法集合以退出码 0 成功、stderr 为空，并在 stdout 报告完整 index 计数。
