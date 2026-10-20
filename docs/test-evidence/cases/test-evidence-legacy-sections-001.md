### Case TEST-EVIDENCE-LEGACY-SECTIONS-001: 旧账本段落解析保留列表语义并拒绝无效声明

Tests:
- `test:68b11626563f38e43335d74d14f6c4b6e0f9c66ce3b01199716e4bc1d984355e`
- `test:ef2faa4dd69bdfa2b06b8c59ab94e4f7990b0a7a928032048d25b02bb046e21a`

Tags:
- `repository-tooling`

Contract:
- 旧账本迁移的 Contract 与 Proves 按列表顺序读取，允许 CRLF 与项间空行并在正文处终止；重复或空 Contract 与 Verification 声明不属于受支持旧格式。

Proves:
- 混合有序和无序列表跨空行保持观察顺序，正文后的列表不再并入 Proves。
- 重复 Contract、空 Contract 和 Verification 分别以对应诊断阻断旧源加载。
