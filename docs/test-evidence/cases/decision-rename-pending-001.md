### Case DECISION-RENAME-PENDING-001: rename 不遗留旧 ID 的 pending stage 快照

Tests:
- `test:6993300587357a8555cc6020529ede264eef974868123ef13cf4bbdbe12268d7`

Tags:
- `decision-records`

Contract:
- rename 不自动 stage；Decision collection 已有 pending snapshot 时必须拒绝 rename，以免 staged view 保存旧 identity。

Proves:
- 已建立 pending stage snapshot 后 rename 返回 `rename-pending-stage-conflict`。
- 冲突拒绝后 source Markdown 未被改写。
