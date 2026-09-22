### Case INVESTIGATION-STAGE-FRESHNESS-001: CLI strict check and stage-index stop on a stale derived index

Tests:
- `test:dcf268c1057a402e2dc4aac36e4ced0bbdcb9ac15a519e949adecb4bc552e97c`

Tags:
- `investigation-report`

Contract:
- 严格 `check` 与 `stage-index` 在派生索引陈旧时失败并停止；stage-index 只在发布当前 projection 后接纳所选报告的暂存。

Proves:
- 报告 title 变化后 `check` 以 `state-index.index-stale` 失败且 stdout 为空。
- 陈旧索引上的 `stage-index` 失败并给出 check → sync-index → retry 恢复序列，git 暂存区与索引工作树路径均保持零变化。
- `sync-index` 发布后同一 `stage-index` 成功并报告 staged for 1 selected report。
