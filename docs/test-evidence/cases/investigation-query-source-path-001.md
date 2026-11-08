### Case INVESTIGATION-QUERY-SOURCE-PATH-001: index and show resolve a report id independently from its semantic sourcePath

Tests:
- `test:d2f29b2b4a4e5053b2f3f2c4358cde771ef56387619f414a6a44d57eb8931d18`

Tags:
- `investigation-report`

Contract:
- show 使用索引的 sourcePath 定位当前报告，而不根据 ID 拼接 basename。

Proves:
- 索引 ID 保持 260101-one、sourcePath 改为 semantic.md，删除原 ID 文件名后 show 仍返回语义路径中的相同正文。
