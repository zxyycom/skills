### Case INDEX-RUNTIME-METADATA-001: 构建类型化元数据并冻结完整索引投影
Entry:
- `tools/index-runtime/tests/runtime.test.ts > builds typed metadata and freezes complete index projections`
- `bun test --test-name-pattern="^builds typed metadata and freezes complete index projections$" ./tools/index-runtime/tests/run.ts`
Contract:
- Metadata 与 state 必须在包含 `{id, metadata}` 的 projection context 中解析，完整 ID-keyed 索引验证接收递归只读快照。
Proves:
- State parser 与 key strategy 获得权威对象键和类型化 metadata；索引 record、stored entry、状态、键与 metadata 均被冻结而源对象不被冻结。
