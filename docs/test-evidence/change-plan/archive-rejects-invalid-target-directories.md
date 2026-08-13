### Case CHANGE-PLAN-ARCHIVE-TARGET-001: 归档拒绝无效目标目录
Entry:
- `tools/change-plan/tests/archive.test.ts > archive rejects invalid target directories`
- `bun test --test-name-pattern="^archive rejects invalid target directories$" ./tools/change-plan/tests/run.ts`
Contract:
- 归档目标必须是当前 Plan 名称对应的未占用路径，archive 容器必须是普通目录；移动前会再次确认目标仍未出现。
Proves:
- 已存在的同名目标、移动前才出现的同名目标和非目录 archive 容器分别返回可定位错误。
- 每种失败都保留活动源目录，晚出现的目标也保持原位。
