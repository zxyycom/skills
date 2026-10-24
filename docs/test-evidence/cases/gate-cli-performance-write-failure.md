### Case GATE-CLI-PERFORMANCE-WRITE-FAILURE-001: 性能报告写入拒绝只新增 quick 阻断

Tests:
- `test:5a2905595f55a3a6a30aa4ae971eff18412a0efc4223e98fcdd5733cb475b61d`

Tags:
- `performance`
- `repository-tooling`

Contract:
- 性能报告无法完成时 quick 必须失败；changed 不因新增性能报告 I/O 改变通过状态，公开诊断不泄露私有异常细节。

Proves:
- 注入性能报告 writer 拒绝时，quick 与 changed 的原生 Run 都 completed/passed；quick 退出 1，changed 退出 0，二者只输出一条固定报告失败诊断且不含注入的私有文本。
