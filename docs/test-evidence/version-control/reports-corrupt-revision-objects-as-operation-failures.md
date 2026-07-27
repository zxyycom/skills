### Case VERSION-CONTROL-CORRUPTION-001: 将损坏修订对象报告为操作失败
Entry:
- `tools/shared/tests/version-control.test.ts > reports corrupt revision objects as operation failures`
- `bun test --test-name-pattern="^reports corrupt revision objects as operation failures$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 只有 Git 确认文件不存在时才返回空值，对象读取失败必须保留为错误。
Proves:
- 损坏 blob 返回带读取上下文的 `operation-failed`，不会被降级为文件缺失。
