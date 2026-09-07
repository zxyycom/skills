### Case DECISION-CANDIDATE-NEW-LOCK-RELEASE-001: New 在锁清理失败后保留已创建 scaffold

Tests:
- `test:1ca5f2fa8e56260c11e297e45ebfb344530729862649d56a3c794aee62cef0f5`

Tags:
- `decision-records`

Contract:
- `new` 已原子发布 scaffold 后若集合锁释放失败，必须报告已提交但待清理，不能误报零写入或覆盖该身份。

Proves:
- CLI 退出 1 并保留已创建 scaffold 的 stdout 路径。
- stderr 使用 collection lock release 的结构化诊断及 `committed-cleanup-pending` outcome。
