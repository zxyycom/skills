### Case INDEX-RUNTIME-SOURCE-REVISION-001: 拒绝同步期间变化的源修订
Entry:
- `tools/index-runtime/tests/materialization.test.ts > rejects a source revision that changes during synchronization`
- `bun test --test-name-pattern="^rejects a source revision that changes during synchronization$" ./tools/index-runtime/tests/run.ts`
Contract:
- 物化快照前后的源修订必须一致。
Proves:
- 修订读取与快照修订不一致时返回 `state-index.source-changed`。
