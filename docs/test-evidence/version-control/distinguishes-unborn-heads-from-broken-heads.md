### Case VERSION-CONTROL-HEAD-001: 区分未诞生 HEAD 与损坏 HEAD
Entry:
- `tools/shared/tests/version-control.test.ts > distinguishes unborn heads from broken heads`
- `bun test --test-name-pattern="^distinguishes unborn heads from broken heads$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 尚无提交的合法 HEAD 返回空修订，损坏引用不得伪装为未诞生状态。
Proves:
- 新仓库返回 `null`，非法对象引用返回 `operation-failed`。
