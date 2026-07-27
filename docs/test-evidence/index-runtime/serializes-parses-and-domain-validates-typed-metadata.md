### Case INDEX-RUNTIME-METADATA-002: 序列化解析并领域验证类型化元数据
Entry:
- `tools/index-runtime/tests/runtime.test.ts > serializes, parses, and domain-validates typed metadata`
- `bun test --test-name-pattern="^serializes, parses, and domain-validates typed metadata$" ./tools/index-runtime/tests/run.ts`
Contract:
- 元数据序列化必须确定，解析必须同时通过协议 schema 与领域完整索引验证。
Proves:
- 合法元数据保留顺序，缺失或畸形协议字段和领域拒绝均返回对应诊断。
