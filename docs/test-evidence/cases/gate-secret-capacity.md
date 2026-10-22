### Case GATE-SECRET-CAPACITY-001: 密钥检测保持有界的完整文件覆盖

Tests:
- `test:f8096373ea46ea2008581faaa00d93a2b810a6443b5dc96f263e202baa78cc66`

Tags:
- `repository-tooling`

Contract:
- 项目密钥检测保留完整文本选集，以 5,120 文件、单文件 1 MiB 和总量 64 MiB 为有限容量；覆盖不足仍阻断，不以排除输入或 finding waiver 绕过。

Proves:
- 使用真实项目 Check 时，4,096 份 TypeScript 源文件与根目录 tsconfig.json 全部取得 detector coverage，无 finding 或 coverage gap。
- 选集增至 5,121 文件时只扫描 5,120 文件并报告一个 coverage gap，结果失败。
- 文件数、单文件及总量预算与空 finding waiver 配置保持项目契约。
