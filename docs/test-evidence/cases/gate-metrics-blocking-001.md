### Case GATE-METRICS-BLOCKING-001: 指标 finding 与测量失效统一 fail closed

Tests:
- `test:3b9bbde0aaf1a54ed31f3c5ea20e4597008e20b5cb01e3f559b072701c7907f9`

Tags:
- `repository-tooling`

Contract:
- 文件与函数指标是 required blocking：可信 finding、SCC 不可用或没有预期输入都必须阻断 aggregate；函数指标使用随包分析器而不依赖 PATH scanner。

Proves:
- 生产 file/function Check 的全部 code area 都配置 blocking policy，文件 waiver 保持空数组。
- 严格阈值产生真实 finding 时两个 Check 均 failed，blocking finding 数等于完整 finding 数。
- 缺失 SCC scanner 使文件指标 unavailable，同时函数 finding 仍 failed；空输入使函数指标 not-applicable；这些状态都使 aggregate failed。
