### Case INDEX-RUNTIME-METADATA-002: 序列化解析并领域验证类型化元数据
Entry:
- `tools/index-runtime/tests/runtime.test.ts > serializes, parses, and domain-validates typed metadata`
- `bun test --test-name-pattern="^serializes, parses, and domain-validates typed metadata$" ./tools/index-runtime/tests/run.ts`
Contract:
- 元数据序列化必须确定，解析必须同时通过协议 schema 与领域完整索引验证。
Proves:
- 合法 metadata 保留顺序；缺失/畸形协议字段、旧 schema 版本和领域拒绝分别返回 schema、版本或完整索引诊断。
