### Case INDEX-RUNTIME-SYNC-MODE-001: 无副作用地拒绝非法同步模式
Entry:
- `tools/index-runtime/tests/materialization.test.ts > rejects invalid sync modes without writing an index`
- `bun test --test-name-pattern="^rejects invalid sync modes without writing an index$" ./tools/index-runtime/tests/run.ts`
Contract:
- 同步入口只能接受受支持模式，非法模式不得创建索引。
Proves:
- 非法模式返回 `mode-invalid` 且目标文件保持不存在。
