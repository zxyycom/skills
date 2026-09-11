### Case INVESTIGATION-INDEX-METADATA-001: index rejects additional metadata

Tests:
- `test:2e7e5627a7a02b2d7d73b9671656701d62cc13994b0b7e117baec0b4444d70dc`

Tags:
- `investigation-report`

Contract:
- 当前 Investigation index 的 metadata 必须是严格空对象。

Proves:
- 写入额外 metadata 后，公共 query 返回 metadata 诊断。
