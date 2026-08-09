### Case INDEX-RUNTIME-STAGING-BOUNDARY-001: 支持首次索引与合法空目标

Entry:
- `tools/index-runtime/tests/staging.test.ts > uses workspace collection data for a missing baseline and permits an empty target`
- `bun test --test-name-pattern="^uses workspace collection data for a missing baseline and permits an empty target$" ./tools/index-runtime/tests/run.ts`

Contract:
- revision 不存在目标索引时使用空基线和工作区集合级契约；选中删除全部 revision 条目时允许完整目标为空。

Proves:
- 首次索引只包含选中的工作区条目，并保留工作区 metadata 与 metadata 来源指纹。
- 删除唯一 revision 条目产生 entries 与逐条来源 revision 同时为空的合法完整索引。
