### Case INVESTIGATION-DISCARD-PENDING-001: discard preserves existing Git pending content

Tests:
- `test:82c56335e805599bfb47d7b791521f20f73041717ccbe93a1167b626c11f433f`

Tags:
- `investigation-report`

Contract:
- discard 只修改工作树，不得改变已有 Git pending 快照。

Proves:
- 删除已记录报告后 cached binary diff 与操作前完全相同。
