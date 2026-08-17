### Case INVESTIGATION-STAGE-RESOURCE-DELETE-001: 暂存主题 A 时忽略主题 B 资源删除

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index selects topic A when topic B resource is deleted`
- `bun test --test-name-pattern="^stage-index selects topic A when topic B resource is deleted$" ./tools/investigation-report/tests/run.ts`

Contract:
- v5 选择性索引暂存不把未选主题的资源删除视为集合级 metadata 变化。

Proves:
- 删除主题 B 资源后，选择主题 A 仍成功暂存，主题 B entry 保持 revision 基线，metadata 为 `{}`。
