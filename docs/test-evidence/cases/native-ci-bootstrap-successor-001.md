### Case NATIVE-CI-BOOTSTRAP-SUCCESSOR-001: 私有两版本验证输入

Tests:
- `test:0ef2d67c32bc7fc8966fedbb8cf0b1d61e62789e9301a5e2830208c6fbf4194d`

Tags:
- `repository-tooling`

Contract:
- 平台私有验收的 B 输入仅对 A 的 Rust 版本和两域 skill 版本执行明确转换；异常输入拒绝，不冒充正式 pending。

Proves:
- 固定样例只转换 Cargo 和两个 skill 版本，A 不变，缺失或异常版本被拒绝；不证明真实构建或平台安装。
