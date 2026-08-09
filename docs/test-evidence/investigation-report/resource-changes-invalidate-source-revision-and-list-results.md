### Case INVESTIGATION-RESOURCE-REVISION-001: 资源变化使来源 Revision 与 List 结果失效

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource changes invalidate source revision and list results`
- `bun test --test-name-pattern="^resource changes invalidate source revision and list results$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源原始字节、ID 集合或报告引用变化必须改变结构化来源 revision，默认 `check` 与 `list` 都不得接受旧索引。

Proves:
- 只修改资源字节时仅 metadata revision 变化，主题 entry revisions 保持不变。
- 资源内容变化和资源重命名后，默认检查与索引查询均失败并定位受影响的资源 ID；重新同步后查询恢复。
