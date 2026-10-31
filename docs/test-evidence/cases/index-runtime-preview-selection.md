### Case INDEX-RUNTIME-PREVIEW-SELECTION-001: 选择性预演保持完整接纳边界

Tests:
- `test:27258954bef50a885f17a5a1eef2ebc7e466d5c6fea9b84f1989fe2246bf19cc`

Tags:
- `index-runtime`

Contract:
- selected preview 与正式 selected 同步共享可信 baseline、完整来源、非空选择和集合 metadata 不变条件。

Proves:
- 合法所选变化返回 previewed、changed=false 和完整 changedIds，同时严格 selected check 仍 scoped-stale。
- 缺失或损坏 baseline、空选择、未知 ID 与 metadata 变化失败且不改写索引；current selected 预演成功 unchanged。
