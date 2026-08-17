### Case INVESTIGATION-STAGE-RESOURCE-RENAME-001: 暂存主题 A 时忽略主题 B 资源改名

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index selects topic A when topic B resource is renamed`
- `bun test --test-name-pattern="^stage-index selects topic A when topic B resource is renamed$" ./tools/investigation-report/tests/run.ts`

Contract:
- v5 选择性索引暂存不把未选主题的资源改名视为集合级 metadata 变化。

Proves:
- 改名主题 B 资源后，选择主题 A 仍成功暂存，主题 B entry 保持 revision 基线，metadata 为 `{}`。
