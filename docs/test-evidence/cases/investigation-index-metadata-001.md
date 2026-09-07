### Case INVESTIGATION-INDEX-METADATA-001: index rejects additional metadata

Tests:
- `test:c65b2d905d7206b9f3a518f80b761545c33d8e671cbc3dcbd04512c292681eae`

Tags:
- `investigation-report`

Contract:
- 当前 Investigation index 的 metadata 必须是严格空对象。

Proves:
- 写入额外 metadata 后，公共 query 返回 metadata 诊断。
