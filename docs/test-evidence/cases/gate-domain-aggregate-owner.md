### Case GATE-DOMAIN-AGGREGATE-OWNER-001: 领域聚合入口只归实际 catalog consumer

Tests:
- `test:6f117a688fb1f52f3cd133196affbb666ced2671930e539f2ce65ec18be781af`

Tags:
- `repository-tooling`

Contract:
- DR/IR 聚合 run.ts 属于已知 catalog 输入，不因属于领域 tests 目录而引发 fallback 或无关领域运行。

Proves:
- 两域 run.ts 分别变化均保持 incremental 且 unclassifiedPaths=[]；test:check 与 check:test-evidence-catalog execute，矩阵指定的领域 record/query/lifecycle/CLI 检查 reuse。
