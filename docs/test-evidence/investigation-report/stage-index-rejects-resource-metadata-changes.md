### Case INVESTIGATION-STAGE-RESOURCE-METADATA-001: 资源 metadata 变化拒绝按主题暂存
Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index rejects attached-resource metadata changes that require full-index staging`
- `bun test --test-name-pattern="^stage-index rejects attached-resource metadata changes that require full-index staging$" ./tools/investigation-report/tests/run.ts`
Contract:
- 随附资源 ID、SHA-256 与 metadata 来源指纹属于完整调查集合；相对 revision 变化时不能归入单个主题 ID。
Proves:
- 资源字节变化并重建工作区索引后，主题选择返回 `collection-changed`，不产生 pending，也不改写索引或资源。
