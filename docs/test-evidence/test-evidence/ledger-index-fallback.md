### Case TEST-EVIDENCE-LEDGER-INDEX-FALLBACK-001: 可恢复索引故障使用当前来源只读回退
Entry:
- `tools/test-evidence/tests/ledger-index.test.ts > ledger queries fall back from recoverable index failures with warnings`
- `bun test --test-name-pattern="^ledger queries fall back from recoverable index failures with warnings$" ./tools/test-evidence/tests/run.ts`
Contract:
- 缺失、损坏、非法编码、旧定义或陈旧索引不得阻断只读查询，回退结果必须来自当前来源并带警告。
Proves:
- 五类可恢复故障都返回当前 Case 集或当前变更，并提示显式重建索引。
