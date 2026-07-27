### Case INDEX-RUNTIME-METADATA-001: 构建类型化元数据并冻结完整索引投影
Entry:
- `tools/index-runtime/tests/runtime.test.ts > builds typed metadata and freezes complete index projections`
- `bun test --test-name-pattern="^builds typed metadata and freezes complete index projections$" ./tools/index-runtime/tests/run.ts`
Contract:
- 元数据必须先解析为领域类型，完整索引验证接收递归只读快照。
Proves:
- 标识与键可读取类型化元数据，索引、条目、状态、键和元数据均被冻结而源对象不被冻结。
