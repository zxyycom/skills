### Case GATE-DOMAIN-AGGREGATE-OWNER-001: 领域聚合入口只归实际 catalog consumer

Tests:
- `test:3954d4bd3b6397f86c22a8e4ac62378aea6cb119757420669112760ddd14e03e`

Tags:
- `repository-tooling`

Contract:
- DR/IR 聚合 run.ts 属于已知 catalog 输入，不因属于领域 tests 目录而引发 fallback 或无关领域运行。

Proves:
- 两域 run.ts 分别变化均保持 incremental 且 unclassifiedPaths=[]；test:check 与 check:test-evidence-catalog execute，矩阵指定的领域 record/query/lifecycle/CLI 检查 reuse。
