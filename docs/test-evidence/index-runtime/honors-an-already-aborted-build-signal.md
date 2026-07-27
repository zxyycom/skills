### Case INDEX-RUNTIME-ABORT-001: 遵守已取消的构建信号
Entry:
- `tools/index-runtime/tests/protocol.test.ts > honors an already-aborted build signal`
- `bun test --test-name-pattern="^honors an already-aborted build signal$" ./tools/index-runtime/tests/run.ts`
Contract:
- 构建入口必须在已取消信号下停止并返回稳定诊断。
Proves:
- 预先取消的信号返回 `state-index.operation-aborted`。
