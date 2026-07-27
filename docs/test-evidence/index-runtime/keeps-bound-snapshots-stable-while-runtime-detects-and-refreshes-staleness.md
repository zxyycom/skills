### Case INDEX-RUNTIME-FRESHNESS-002: 保持绑定快照稳定并由 runtime 刷新旧索引
Entry:
- `tools/index-runtime/tests/runtime.test.ts > keeps bound snapshots stable while runtime detects and refreshes staleness`
- `bun test --test-name-pattern="^keeps bound snapshots stable while runtime detects and refreshes staleness$" ./tools/index-runtime/tests/run.ts`
Contract:
- 已打开 reader 保持原快照，runtime 直接操作必须检测源修订变化并在同步后读取新状态。
Proves:
- 源变化后 reader 仍返回旧状态，runtime 先报旧索引并在重建后成功读取。
