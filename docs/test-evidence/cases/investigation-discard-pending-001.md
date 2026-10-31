### Case INVESTIGATION-DISCARD-PENDING-001: discard preserves existing Git pending content

Tests:
- `test:883f47cd956c878af11a07424d0d5fb6107bc6f3c74d33be75455a90def990f3`

Tags:
- `investigation-report`

Contract:
- discard 只修改工作树，不得改变已有 Git pending 快照。

Proves:
- 删除已记录报告后 cached binary diff 与操作前完全相同。
