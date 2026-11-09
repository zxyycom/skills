### Case NATIVE-CI-BOOTSTRAP-SUCCESSOR-001: 私有两版本验证输入

Tests:
- `test:d5917db4a53b18b84268528dd5c075e40e7554776fc0a5f0562a600acfbbdb00`

Tags:
- `repository-tooling`

Contract:
- 平台私有验收的 B 输入仅对 A 的 Rust 版本和两域 skill 版本执行明确转换；异常输入拒绝，不冒充正式 pending。

Proves:
- 固定样例检查 Cargo 和两个 skill 版本的转换、A 不变及异常源码输入被拒绝；不证明真实构建或平台安装。
