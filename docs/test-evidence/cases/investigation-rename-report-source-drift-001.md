### Case INVESTIGATION-RENAME-REPORT-SOURCE-DRIFT-001: 回滚不覆盖外部重建的旧报告路径

Tests:
- `test:4e78eaedf5fd0094ec8a7576fa824274d445463ed2c5a02b1dc467df9262cce0`

Tags:
- `investigation-report`

Contract:
- rename 回滚只可在旧路径缺失时使用 exclusive create 恢复原始字节和权限；旧路径在移动后被外部重建时不得覆盖。新路径也只能在仍等于本事务写入快照时删除。

Proves:
- index writer 在报告移动后重建旧路径并失败时，外部旧报告字节保持不变。
- 本事务新路径安全删除，但事务报告 `partial-or-unknown`，提示后续对账而非伪报完整 rollback。
