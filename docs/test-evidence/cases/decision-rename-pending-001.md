### Case DECISION-RENAME-PENDING-001: rename 不遗留旧 ID 的 pending stage 快照

Tests:
- `test:58de84302154189d9b261528c630c0953a07910df1a8eff2471ae62b22c03c18`

Tags:
- `decision-records`

Contract:
- rename 不自动 stage；Decision collection 已有 pending snapshot 时必须拒绝 rename，以免 staged view 保存旧 identity。

Proves:
- 已建立 pending stage snapshot 后 rename 返回 `rename-pending-stage-conflict`。
- 冲突拒绝后 source Markdown 未被改写。
