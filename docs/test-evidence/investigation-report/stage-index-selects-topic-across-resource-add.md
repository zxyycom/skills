### Case INVESTIGATION-STAGE-RESOURCE-ADD-001: 暂存主题 A 时忽略主题 B 新增的未引用 v5 资源

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index selects topic A when topic B adds an unrelated v5 resource`
- `bun test --test-name-pattern="^stage-index selects topic A when topic B adds an unrelated v5 resource$" ./tools/investigation-report/tests/run.ts`

Contract:
- v5 选择性索引暂存仅合并被选主题的主题 Markdown 变化；其他主题资源池新增不构成集合级 metadata 变化。

Proves:
- 主题 B 新增未引用资源后，选择主题 A 仍成功暂存，主题 B entry 保持 revision 基线，metadata 为 `{}`。
