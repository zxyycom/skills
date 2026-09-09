### Case GATE-METRICS-ADVISORY-001: 指标 finding 保持 advisory，工具故障与 N/A fail closed

Tests:
- `test:4910ef99a25d4fc8d539a2f8c0b36997525f792a110ab64b9a179470f6c0b43a`

Tags:
- `repository-tooling`

Contract:
- 文件与函数指标是 required advisory：可信 finding 只能作为 warning 形成 passed；SCC 不可用或没有预期输入必须使 aggregate failed，函数指标使用随包分析器而不依赖 PATH scanner。

Proves:
- 严格阈值产生真实指标 finding 时两个 Check 仍 passed；该 fixture 的 blocking finding 数为零，文件 waiver 明确为空数组。仓库实际 finding 数不属于本 Case 的契约。
- 缺失 SCC scanner 使文件指标 unavailable，而同次函数指标仍 passed；空输入使函数指标 not-applicable；两种非通过状态都使 aggregate failed。
