### Case TEST-EVIDENCE-LEGACY-SECTIONS-001: 旧账本段落解析保留列表语义并拒绝无效声明

Tests:
- `test:1929882320e2f5a33500ec1abdc4cd946d31cfc42eac0d24ac83f6bf1dac44a5`
- `test:47607a73caa991292fd46c5e320581a807b0d38e92273c20dcdf85fb57ad541b`

Tags:
- `repository-tooling`

Contract:
- 旧账本迁移的 Contract 与 Proves 按列表顺序读取，允许 CRLF 与项间空行并在正文处终止；重复或空 Contract 与 Verification 声明不属于受支持旧格式。

Proves:
- 混合有序和无序列表跨空行保持观察顺序，正文后的列表不再并入 Proves。
- 重复 Contract、空 Contract 和 Verification 分别以对应诊断阻断旧源加载。
