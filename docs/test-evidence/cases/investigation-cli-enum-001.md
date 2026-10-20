### Case INVESTIGATION-CLI-ENUM-001: CLI 拒绝非法关系与 Trace 枚举

Tests:
- `test:fcf1c5016114731f5a51143e850ca3894f8ef7443d486f2e94717c61c34b2d45`

Tags:
- `investigation-report`

Contract:
- CLI 必须拒绝非法关系类型与 Trace direction，并按各自边界返回退出结果。

Proves:
- 同进程源码 CLI 对未知关系类型返回退出码 1 与 relation type 诊断；非法 Trace direction 返回退出码 2 与 direction 诊断，两者 stdout 均为空。
