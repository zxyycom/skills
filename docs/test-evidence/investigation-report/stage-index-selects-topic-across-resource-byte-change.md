### Case INVESTIGATION-STAGE-RESOURCE-BYTES-001: 暂存主题 A 时忽略主题 B 资源字节变化

Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index selects topic A when topic B resource bytes change`
- `bun test --test-name-pattern="^stage-index selects topic A when topic B resource bytes change$" ./tools/investigation-report/tests/run.ts`

Contract:
- v5 选择性索引暂存不把未选主题的资源字节纳入来源 revision 或集合级 metadata。

Proves:
- 主题 B 已有资源字节变化后，选择主题 A 仍成功暂存，主题 B entry 保持 revision 基线，metadata 为 `{}`。
