### Case INVESTIGATION-RELATION-SUMMARY-MARKDOWN-001: 报告关系摘要的规范序列化

Tests:
- `test:6b1d90b11e911a5582c4be9c11b3134cb3bba661c15e7ce30083c05451b19004`
- `test:b19a043472206c16231990677aaaa8ecd2dcb6b756ca5af3109ff7ad11536fc7`

Tags:
- `investigation-report`

Contract:
- 来源摘要先 trim，空值省略，非空必须单行且最多 40 个 Unicode 码点；写入关系时保留规范字段顺序。

Proves:
- 来源解析与正式状态投影均保留 trim 后摘要并省略空白摘要；内部换行和 41 个非 BMP 码点拒绝，40 个通过。
- 关系替换写出 type、target、summary 顺序及摘要文本；非法关系类型被拒绝。
