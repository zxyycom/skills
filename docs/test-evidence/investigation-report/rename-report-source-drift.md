### Case INVESTIGATION-RENAME-REPORT-SOURCE-DRIFT-001: 回滚不覆盖外部重建的旧报告路径

Entry:
- `tools/investigation-report/tests/rename.test.ts > Investigation rename preserves an old report rebuilt after its move`
- `bun test --test-name-pattern="^Investigation rename preserves an old report rebuilt after its move$" ./tools/investigation-report/tests/run.ts`

Contract:
- rename 回滚只可在旧路径缺失时使用 exclusive create 恢复原始字节和权限；旧路径在移动后被外部重建时不得覆盖。新路径也只能在仍等于本事务写入快照时删除。

Proves:
- index writer 在报告移动后重建旧路径并失败时，外部旧报告字节保持不变。
- 本事务新路径安全删除，但事务报告 `partial-or-unknown`，提示后续对账而非伪报完整 rollback。
