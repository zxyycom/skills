### Case INVESTIGATION-SNAPSHOT-DUPLICATE-STATE-001: index state projects strict empty metadata and sourcePath

Tests:
- `test:d1eb5a540d7286eff01c09db699e5079a232464e1d3b7d60070fc9ec01d01f68`

Tags:
- `investigation-report`

Contract:
- 报告索引 metadata 必须严格为空；entry 直接保存 state，且可回读其中的 sourcePath。

Proves:
- 真实来源准备、Markdown 解析、state 构建及索引序列化在内存中产生 metadata 为 `{}` 的 JSON；报告 entry 直接保存 `report.md` sourcePath、没有 wrapper 或持久 query values，公开 schema 也声明并要求该字段。
