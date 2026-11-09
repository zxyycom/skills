### Case NATIVE-OVERLAY-ACTIVATION-001: 原生覆盖最后启用入口

Tests:
- `test:2779d25c1ea8419063b696b321ce4378406af409aca3fc48dd6966d52c5469cf`

Tags:
- `repository-tooling`

Contract:
- 验证完成后才启用入口，包外文件保留。

Proves:
- 验证时可观察新程序与旧入口，成功后入口更新且 sentinel 保留；非 Windows 验证执行位。
