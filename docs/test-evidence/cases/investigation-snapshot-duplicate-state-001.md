### Case INVESTIGATION-SNAPSHOT-DUPLICATE-STATE-001: 调查索引 metadata 与 sourcePath

Tests:
- `test:254b741c592ab9047df47c96fd959aa77a863b700412e6daa10a4207f380befd`
- `test:45f8d1ac72065e376f8df03fba4a2547bcb71b8dcbbb9e0ff76f4c6614844ad7`

Tags:
- `investigation-report`

Contract:
- 调查索引 metadata 为严格空对象，entry 的 sourcePath 独立于 ID 用于定位报告。

Proves:
- 原生解析对有效空 metadata 索引成功、非空 metadata 拒绝。
- 真实 Git domain stage 使用索引中的语义文件名 new-location.md 定位所选 ID，并暂存该文件与该 ID 的 owner 资源。
