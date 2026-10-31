### Case INVESTIGATION-STAGE-PRESERVED-INDEX-DELETION-001: worktree 恢复不覆盖未选 pending 删除

Tests:
- `test:baaec37034e6eeba451cc4c961dad38fc52679b18098ed777073273871832a83`

Tags:
- `investigation-report`

Contract:
- index/all 以 pending 而非 HEAD 组合，未选对象的 pending 删除不受当前 worktree 恢复影响。

Proves:
- 先选择 B 暂存删除，再在 worktree 恢复 B 并更新 A，选 A 只刷新 A；B 仍不在 pending 索引，all 也保留正文 staged 删除。
