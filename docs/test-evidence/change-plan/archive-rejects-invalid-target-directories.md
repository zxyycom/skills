### Case CHANGE-PLAN-ARCHIVE-TARGET-001: 归档拒绝无效目标目录
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects invalid target directories`
- `bun test --test-name-pattern="^archive rejects invalid target directories$" ./tools/change-plan/tests/run.ts`
Contract:
- 归档目标必须满足生命周期目录与目标命名约束。
Proves:
- 冲突或非法目标目录在写入前被拒绝。
