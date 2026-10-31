### Case INVESTIGATION-DISCARD-CANDIDATE-004: 候选删除在 tombstone 提交后报告待清理

Tests:
- `test:6467802d24a68628a32d4ca8a7c54d6b1d00b743720cbbe5782c9e29d722f143`

Tags:
- `investigation-report`

Contract:
- 统一 `discard` 在 candidate tombstone 已提交但精确清理失败时，保留已提交删除并返回 `committed-cleanup-pending` 供定向恢复。

Proves:
- 注入 tombstone cleanup 失败后 candidate 已从 authoring workspace 删除，结果保留 cleanup residue、明确 mutation outcome 与恢复所需诊断。
