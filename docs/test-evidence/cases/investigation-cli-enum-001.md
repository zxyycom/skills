### Case INVESTIGATION-CLI-ENUM-001: CLI 拒绝非法关系与 Trace 枚举

Tests:
- `test:fcf1c5016114731f5a51143e850ca3894f8ef7443d486f2e94717c61c34b2d45`

Tags:
- `investigation-report`

Contract:
- CLI 必须在参数边界拒绝非法关系类型与 Trace direction。

Proves:
- 未知关系类型和 direction 均以退出码 2 结束，只向 stderr 返回参数诊断。
