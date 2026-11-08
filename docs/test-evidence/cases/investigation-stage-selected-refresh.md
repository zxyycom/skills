### Case INVESTIGATION-STAGE-SELECTED-REFRESH-001: 索引选择性刷新保留未选 pending

Tests:
- `test:377f869a34af709f3f1366295acf1d3e0190cb773fe725973ce69f242045e849`

Tags:
- `investigation-report`

Contract:
- index stage 更新所选 worktree 投影时保留未选 pending 投影。

Proves:
- 真实 Git 中 alpha 采用 worktree 标题，beta 保留 pending 标题，工作区索引字节不变。
