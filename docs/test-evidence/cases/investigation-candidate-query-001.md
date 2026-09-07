### Case INVESTIGATION-CANDIDATE-QUERY-001: candidate queries report readiness without affecting formal sources

Tests:
- `test:352bcb06674be9c003923f11c3f0492f5012ef45b836231a89bb71bc9f239041`

Tags:
- `investigation-report`

Contract:
- 候选查询独立返回 scaffold、body 与 resource readiness；候选及其 authoring resource 不参与正式 source revision、正式查询、正式索引成员或 index-only staging。

Proves:
- 完整候选及其自有资源返回三个 ready 状态，并可由 `show-candidate` 读取。
- 正式 source revision、`sync-index`、`list`、`show` 与 `trace` 只读取正式报告，默认检查不会把候选 owner 当作缺失的正式 owner。
- `stage-index` 只暂存正式 index 变化，不会暂存候选文件。
