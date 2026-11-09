### Case NATIVE-UPDATER-CLI-REINSTALL-001: 同版本显式重装

Tests:
- `test:07596a0594e1b75d083d68ae936b60830de912cdfb876eb14a58da7060d71d1a`

Tags:
- `repository-tooling`

Contract:
- 版本检查不修复缺失文件；独立安装器可明确重装同版本。

Proves:
- Linux 合成程序验证缺失程序时检查仍报告版本一致，显式重装恢复程序及执行位；不证明 Windows。
