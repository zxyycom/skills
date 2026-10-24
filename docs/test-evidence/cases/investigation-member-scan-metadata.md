### Case INVESTIGATION-MEMBER-SCAN-METADATA-001: 成员采集保持完整有序元数据且不读正文

Tests:
- `test:15925cd6babc004edcfe1b196a7927c9e07c052f24f7492205ebb996e4dbf4ca`

Tags:
- `investigation-report`

Contract:
- 调查集合成员采集排除单独受保护的 investigation-index.json，按名字排序保留其他安全根成员的 path、dev、ino、mode、kind，不读取成员正文。

Proves:
- 乱序建立跨批次的普通文件与目录，并令文件打开和正文读取直接失败；采集结果仍等于独立取得的完整身份、显式权限、类型与已知词法顺序。
- investigation-index.json 即使是符号链接，也不进入该成员集。
