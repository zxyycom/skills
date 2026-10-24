### Case GATE-CLI-PERFORMANCE-BOUNDARY-001: CLI 只对 quick 应用含准备与报告开销的预算

Tests:
- `test:f86eb21615e32300c97d39e9d6a4220c1e2f891679d28cfaf22ef68f362efbc7`

Tags:
- `performance`
- `repository-tooling`

Contract:
- quick 总墙钟从输入准备前开始并涵盖性能报告开销；项目预算不得改写原生 Run aggregate，changed、full、release 与 CI 只报告性能。
- full 与 CI 的完整 base 摘要排除 release-only 决策，不改变原始计划。

Proves:
- 性能摘要的计划选择数按实际 catalog 区分 quick 的 10 项、完整 base 的 64 项与 release 的 67 项，禁用数量分别为 57、3 与 0；CI 使用完整 base，声明无复用时 execute 与 eligible 一致。
- 注入时钟使准备耗时达到 30000 毫秒或报告后才达到该值时，原生 aggregate 仍 passed，但 quick 退出 1；后一种 machine 报告标记 after-performance-report 边界且性能失败。
- 同一耗时下 changed、full、兼容 release 与 CI 退出 0；CI 解析为 full，full/release/CI 不传增量 activeToolIds；full 与 CI 摘要只保留 base Check 并如实计数。
