### Case GATE-METRICS-ADVISORY-001: 指标 finding 保持 advisory，工具故障与 N/A fail closed

Tests:
- `test:96da15b16690f5d951944b0d47cc6afa1ad75f16cb51e4f9ae8709956cf8bb95`

Tags:
- `repository-tooling`

Contract:
- 文件与函数指标是 required advisory：可信 finding 只能作为 warning 形成 passed；SCC 不可用或没有预期输入必须使 aggregate failed，函数指标使用随包分析器而不依赖 PATH scanner。

Proves:
- 严格阈值产生真实指标 finding 时两个 Check 仍 passed；该 fixture 的 blocking finding 数为零，文件 waiver 明确为空数组。仓库实际 finding 数不属于本 Case 的契约。
- 缺失 SCC scanner 使文件指标 unavailable，而同次函数指标仍 passed；空输入使函数指标 not-applicable；两种非通过状态都使 aggregate failed。
