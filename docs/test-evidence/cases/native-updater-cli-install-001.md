### Case NATIVE-UPDATER-CLI-INSTALL-001: 原生多级目标安装

Tests:
- `test:82c79532d571247b6da9bce704ba55d7ecbb36e52748c9cb3fa250bfdef49475`

Tags:
- `repository-tooling`

Contract:
- 多级缺失目标在确认后创建，检查保持只读。

Proves:
- Linux 合成程序验证缺失目标检查不写、确认后安装与程序执行位；不访问真实网络或证明 Windows。
