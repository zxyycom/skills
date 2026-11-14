### Case NATIVE-CI-BOOTSTRAP-SUCCESSOR-001: 私有两版本验证输入

Tests:
- `test:d5917db4a53b18b84268528dd5c075e40e7554776fc0a5f0562a600acfbbdb00`

Tags:
- `repository-tooling`

Contract:
- 平台私有验收的 B 输入仅对 A 的 Rust 版本和三域 skill 版本执行明确转换；异常输入拒绝，不冒充正式 pending。

Proves:
- 固定样例检查 B 的 Cargo.toml 和三个 skill 版本转换、A 的 Cargo.toml 与 decision skill 版本保持，以及异常源码输入被拒绝；未逐字节核对 A 的其余输入或 B 的全部非版本内容，不证明真实构建或平台安装。
