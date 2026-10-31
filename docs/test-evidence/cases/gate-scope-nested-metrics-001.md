### Case GATE-SCOPE-NESTED-METRICS-001: 嵌套维护目录保留精确 Scope 指标范围

Tests:
- `test:521c23dbfc5e687465a84db62aad047860917d29fbdc760c685f64b16bdd1e38`

Tags:
- `repository-tooling`

Contract:
- 按能力显式选择的文件与函数指标必须覆盖该能力的嵌套维护源码，且不得因目录迁移扩大到其他能力。

Proves:
- 在同一现场放置二十四个能力的嵌套代表文件，逐个选择能力并经原生文件收集器核对两个指标的精确文件集合；新模块不依赖旧文件名前缀。
