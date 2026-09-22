### Case INVESTIGATION-STAGE-FRESHNESS-001: CLI strict check and stage stop on a stale derived index

Tests:
- `test:b76fd075f52b30ebb48aff40afa6b7a58c3ebfe638700203b1f00845b6bdae28`

Tags:
- `investigation-report`

Contract:
- 严格 `check` 与 `stage` 在派生索引陈旧时失败并停止；stage 只在发布当前 projection 后接纳所选报告的暂存。

Proves:
- 报告 title 变化后 `check` 以 `state-index.index-stale` 失败且 stdout 为空。
- 陈旧索引上的 `stage --scope index` 失败并给出 check → sync-index → retry 恢复序列，git 暂存区与索引工作树路径均保持零变化。
- `sync-index` 发布后同一 `stage --scope index` 成功并报告 staged (scope: index) for 1 selected report。
