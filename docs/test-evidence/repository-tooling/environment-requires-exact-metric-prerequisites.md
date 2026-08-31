### Case ENV-METRICS-PREREQUISITES-001: 环境精确诊断 SCC 与 Lizard 且不自动安装

Entry:
- `scripts/environment.test.ts > environment requires exact SCC and Lizard prerequisites without installing them`
- `bun test --test-name-pattern="^environment requires exact SCC and Lizard prerequisites without installing them$" ./scripts/environment.test.ts`

Contract:
- 环境入口必须复用精确的 SCC 3.7.0 与 Lizard 1.23.0；missing、mismatch 和 probe failure 都提供恢复诊断，`setup` 不负责安装这些全局工具。

Proves:
- 准备好的精确版本使 setup 成功。
- 缺失 SCC、版本不匹配 Lizard 与 SCC probe failure 都使 check 失败并指出对应恢复动作。
- 缺失 SCC 时 setup 在仓库写入和工具安装前退出，并明确说明该脚本不会安装全局前置条件。
