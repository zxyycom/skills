### Case NATIVE-CI-BOOTSTRAP-FIRST-TARGET-001: 首次引导目标前置状态

Tests:
- `test:3979af3e270a4cb4eae2cb248aa5b12425cdc4336f71a66932d5e77cd27f91c1`
- `test:6e98b59342435a8dd18b978bc0a70cbb62163c638fa92b0fc75391899e3c3a03`

Tags:
- `repository-tooling`

Contract:
- 私有与真实 release bootstrap 平台验收的新装目标在检查和激活前必须为空；旧版交接则在激活前保留自有 sentinel 以验证迁移不覆盖。

Proves:
- 真实目标状态验证器和隔离 bootstrap 替身分别检查新装和旧版的检查、激活与 sentinel 时序；在线验收节点另通过隔离子进程验证参数及相同的前置状态。不证明真实平台安装、远端下载或旧版清理。
