### Case INVESTIGATION-DISCARD-CANDIDATE-004: discard-candidate reports pending cleanup after tombstone commit

Tests:
- `test:921304d3a3667ee419414bf6516976f960b803f22dbbec3e3583c34eadee063a`

Tags:
- `investigation-report`

Contract:
- `discard-candidate` 在 candidate tombstone 已提交但精确清理失败时，保留已提交删除并返回 `committed-cleanup-pending` 供定向恢复。

Proves:
- 注入 tombstone cleanup 失败后 candidate 已从 authoring workspace 删除，结果保留 cleanup residue、明确 mutation outcome 与恢复所需诊断。
