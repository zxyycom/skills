### Case ENV-METRICS-PREREQUISITES-001: 环境精确诊断 SCC 且不自动安装

Tests:
- `test:ad7e09e7bb92a614e4c01e8e8e8f208aa0a3f768d609aca008916583dacefbee`

Tags:
- `repository-tooling`

Contract:
- 环境入口必须复用精确的 SCC 4.0.0；missing、mismatch 和 probe failure 都提供恢复诊断，`setup` 不负责安装该全局工具。

Proves:
- 精确 SCC 版本使 setup 成功；missing、mismatch、probe failure 的 check 均给出对应恢复诊断。
- 缺 SCC setup 在仓库写入与工具安装前退出，独立命令日志没有 pnpm install/npm/corepack/go 调用；不安装全局前置。
