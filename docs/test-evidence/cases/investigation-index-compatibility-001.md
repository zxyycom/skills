### Case INVESTIGATION-INDEX-COMPATIBILITY-001: 调查索引拒绝旧 definitionVersion

Tests:
- `test:45f8d1ac72065e376f8df03fba4a2547bcb71b8dcbbb9e0ff76f4c6614844ad7`

Tags:
- `investigation-report`

Contract:
- 调查索引只接受当前 definition 版本。

Proves:
- 完整有效 IR 索引先通过；仅把 definitionVersion 改成 10 后原生解析拒绝。
