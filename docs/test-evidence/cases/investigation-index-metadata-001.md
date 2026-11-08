### Case INVESTIGATION-INDEX-METADATA-001: 调查索引 metadata 必须为空

Tests:
- `test:45f8d1ac72065e376f8df03fba4a2547bcb71b8dcbbb9e0ff76f4c6614844ad7`

Tags:
- `investigation-report`

Contract:
- 调查索引 metadata 必须为严格空对象。

Proves:
- 完整有效 IR 索引先通过；仅增加一项 metadata 后原生解析拒绝。
