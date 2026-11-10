### Case IR-RESOURCE-SCAN-BUDGET-001: 不足覆盖与显式关闭分别表达

Tests:
- `test:38d74c20e42835dadfc5f2351c50d8284f562d3610615211da0bca5d881948de`
- `test:75111452fd58122b5920ba5be30b513064a908633b017111b77c941a2e06b99d`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 内容检查受单次读取预算约束，预算不足和显式关闭均不冒充完整检查。

Proves:
- 扫描入口在 32 字节预算下对 64 KiB 资源返回 incomplete 与 skippedFiles，预留量不超预算；关闭诊断时即便引用不存在仍返回关闭、非完整及零观察状态。
