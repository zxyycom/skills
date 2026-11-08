### Case DECISION-RENAME-PENDING-001: rename 不遗留旧 ID 的 pending stage 快照

Tests:
- `test:124190f5575c7b94adda23d009430cd65bcd96b59142f05406a4bfe20dd5f20c`

Tags:
- `decision-records`

Contract:
- rename 不自动 stage；Decision collection 已有 pending snapshot 时必须拒绝 rename，以免 staged view 保存旧 identity。

Proves:
- 真实 Git 中领域 pending 拒绝 rename，原生 CLI JSON 报告 `decision-records.rename-pending-stage-conflict`，保留 index 字节并保留原来源路径。
- 不相关 pending 不阻断；未出生 HEAD 的领域 pending 同样拒绝。
