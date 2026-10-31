### Case REPO-SKILL-HASH-003: Declaration formatting does not require a version

Tests:
- `test:e6556be838c06eb7d27c80d772f1c2bf55bbb9d446ffb6bb5881850c0b9f235e`

Tags:
- `repository-tooling`

Contract:
- 成对存在的 `.d.mts` 以根目录 `.oxfmtrc.json` 的 Oxfmt 配置规范化后确定版本承载；纯格式差异不承载版本，语义差异承载版本。

Proves:
- 可规范化为同一声明的差异不产生版本门禁诊断。
- 声明类型语义变化在未提升 metadata.version 时产生版本门禁诊断。
