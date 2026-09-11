### Case ENV-METRICS-PREREQUISITES-001: 环境精确诊断 SCC 且不自动安装

Tests:
- `test:ad7e09e7bb92a614e4c01e8e8e8f208aa0a3f768d609aca008916583dacefbee`

Tags:
- `repository-tooling`

Contract:
- 环境入口必须复用精确的 SCC 4.0.0；missing、mismatch 和 probe failure 都提供恢复诊断，`setup` 不负责安装该全局工具。

Proves:
- 准备好的精确版本使 setup 成功。
- 缺失、版本不匹配与 probe failure 都使 check 失败并指出对应恢复动作。
- 缺失 SCC 时 setup 在仓库写入和工具安装前退出，并明确说明该脚本不会安装全局前置条件。
