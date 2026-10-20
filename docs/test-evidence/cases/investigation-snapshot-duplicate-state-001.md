### Case INVESTIGATION-SNAPSHOT-DUPLICATE-STATE-001: index state projects strict empty metadata and sourcePath

Tests:
- `test:2439f944586d48dff33d0004f0814b0c0842b4b2cd1d6993207178da00bc9409`

Tags:
- `investigation-report`

Contract:
- 报告索引 metadata 必须严格为空；entry 直接保存 state，且可回读其中的 sourcePath。

Proves:
- 真实来源准备、Markdown 解析、state 构建及索引序列化在内存中产生 metadata 为 `{}` 的 JSON；报告 entry 直接保存 `report.md` sourcePath、没有 wrapper 或持久 query values，公开 schema 也声明并要求该字段。
