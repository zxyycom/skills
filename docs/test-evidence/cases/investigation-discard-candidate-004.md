### Case INVESTIGATION-DISCARD-CANDIDATE-004: 候选删除在 tombstone 提交后报告待清理

Tests:
- `test:831fef3f3b9f13ee7653774d0690c56d7dbaee13043811829414938804b42b74`

Tags:
- `investigation-report`

Contract:
- 统一 `discard` 在 candidate tombstone 已提交但精确清理失败时，保留已提交删除并返回 `committed-cleanup-pending` 供定向恢复。

Proves:
- 注入 tombstone cleanup 失败后 candidate 已从 authoring workspace 删除，结果保留 cleanup residue、明确 mutation outcome 与恢复所需诊断。
