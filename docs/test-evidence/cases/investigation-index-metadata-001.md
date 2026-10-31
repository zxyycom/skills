### Case INVESTIGATION-INDEX-METADATA-001: index rejects additional metadata

Tests:
- `test:7419d3345558fd4f23ed3a770d68b605272bdae32da7d6928d08077b11b911aa`

Tags:
- `investigation-report`

Contract:
- 当前 Investigation index 的 metadata 必须是严格空对象。

Proves:
- 真实索引解析器按当前领域 definition 解析含额外 metadata 的内存 JSON 时，返回 metadata 诊断。
