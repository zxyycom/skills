### Case INDEX-RUNTIME-SOURCE-SNAPSHOT-001: 报告畸形源快照
Entry:
- `tools/index-runtime/tests/protocol.test.ts > reports malformed source snapshots`
- `bun test --test-name-pattern="^reports malformed source snapshots$" ./tools/index-runtime/tests/run.ts`
Contract:
- 定义的读取器必须返回结构完整的源快照。
Proves:
- 返回空值的读取器使构建以错误结果结束。
