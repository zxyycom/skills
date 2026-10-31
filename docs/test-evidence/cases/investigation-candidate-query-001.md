### Case INVESTIGATION-CANDIDATE-QUERY-001: candidate queries report readiness without affecting formal sources

Tests:
- `test:f50d99c1a807777ca515a54ad76af091b015d621a035388516ecaf7c46a67e5b`

Tags:
- `investigation-report`

Contract:
- 候选查询独立返回 scaffold、body 与 resource readiness；候选及其 authoring resource 不参与正式 source revision、正式查询或正式索引成员。

Proves:
- 完整候选及其自有资源返回三个 ready 状态，并可由 `show-candidate` 读取。
- 正式 source revision、`sync-index`、`list`、`show` 与 `trace` 只读取正式报告，默认检查不会把候选 owner 当作缺失的正式 owner。
