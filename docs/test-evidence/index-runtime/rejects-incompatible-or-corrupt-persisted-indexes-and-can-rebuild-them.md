### Case INDEX-RUNTIME-PERSISTENCE-001: 拒绝不兼容或损坏索引并可重建
Entry:
- `tools/index-runtime/tests/runtime.test.ts > rejects incompatible or corrupt persisted indexes and can rebuild them`
- `bun test --test-name-pattern="^rejects incompatible or corrupt persisted indexes and can rebuild them$" ./tools/index-runtime/tests/run.ts`
Contract:
- runtime 必须拒绝与定义投影不一致或领域状态损坏的持久化索引，并支持从源重建。
Proves:
- 不兼容投影和错误状态类型返回带路径诊断，写同步恢复索引。
