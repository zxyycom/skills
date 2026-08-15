### Case DECISION-GENERATED-ARTIFACTS-001: 生成制品公开带标签的 ID 契约与可移植元数据

Entry:
- `tools/decision-records/tests/generated-artifacts.test.ts > generated decision artifacts expose the tagged ID contract and portable metadata`
- `bun test --test-name-pattern="^generated\ decision\ artifacts\ expose\ the\ tagged\ ID\ contract\ and\ portable\ metadata$" ./tools/decision-records/tests/run.ts`

Contract:
- 分发制品的 Schema、API 与可移植元数据必须公开稳定 ID、tags 和 sourcePath 契约，并排除已移除的分类字段。

Proves:
- 生成模块与元数据均包含当前 ID/标签/路径字段并保持可导入。
