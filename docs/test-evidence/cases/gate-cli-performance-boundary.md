### Case GATE-CLI-PERFORMANCE-BOUNDARY-001: CLI 只对 quick 应用入口至报告收尾的预算

Tests:
- `test:5b012b92a1b3938b3cbbaf1c9618fb88b6095d61500fac1825e21fcae38fa8ad`

Tags:
- `performance`
- `repository-tooling`

Contract:
- quick 总墙钟从调用入口开始并涵盖性能报告开销；项目预算不得改写原生 Run aggregate，changed、full、release 与 CI 只报告性能。
- full 与 CI 的完整 base 摘要排除 release-only 决策，不改变原始计划。

Proves:
- 性能摘要的计划选择数按实际 catalog 区分 quick 的 6 项、完整 base 的 66 项与 release 的 69 项，禁用数量分别为 63、3 与 0；CI 使用完整 base，声明无复用时 execute 与 eligible 一致。
- 注入时钟使入口至报告的耗时达到 30000 毫秒或报告后才达到该值时，原生 aggregate 仍 passed，但 quick 退出 1；后一种 machine 报告标记 after-performance-report 边界且性能失败。
- 同一耗时下 changed、full、兼容 release 与 CI 退出 0；CI 解析为 full，full/release/CI 不传增量 activeToolIds；full 与 CI 摘要只保留 base Check 并如实计数。
