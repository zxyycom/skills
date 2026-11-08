### Case INVESTIGATION-RESOURCE-NAME-001: 调查索引拒绝资源路径穿越

Tests:
- `test:45f8d1ac72065e376f8df03fba4a2547bcb71b8dcbbb9e0ff76f4c6614844ad7`

Tags:
- `investigation-report`

Contract:
- 调查索引不得接纳资源 ID 中的路径穿越。

Proves:
- 合法索引先通过，将 resourceIds 改成 report/../secret 后解析失败。
